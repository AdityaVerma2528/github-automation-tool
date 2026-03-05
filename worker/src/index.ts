import { Kafka } from "kafkajs";
import axios from "axios";
import { PrismaClient } from "@prisma/client";

const kafka = new Kafka({
    clientId: "zap-worker",
    brokers: ["localhost:9092"],
});

const prisma = new PrismaClient();

const consumer = kafka.consumer({ groupId: "zap-actions-group" });

type ActionType =
    | "create_comment"
    | "add_label"
    | "assign_reviewer"
    | "close_issue"
    | "call_webhook";

interface ActionData {
    zapId: string;
    actionType: ActionType;
    actionConfig: any;
    payload: any;
    githubToken: string;
}

type ActionHandler = (data: ActionData) => Promise<void>;

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function extractRepoInfo(payload: any) {
    const owner = payload.repository.owner.login;
    const repo = payload.repository.name;

    const issueNumber =
        payload.issue?.number ||
        payload.pull_request?.number;

    const prNumber = payload.pull_request?.number;

    return { owner, repo, issueNumber, prNumber };
}

const actionHandlers: Record<ActionType, ActionHandler> = {
    create_comment: async (data: any) => {
        const { payload, actionConfig, githubToken } = data;
        const { owner, repo, issueNumber } = extractRepoInfo(payload);

        await axios.post(
            `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
            { body: actionConfig.body },
            {
                headers: {
                    Authorization: `token ${githubToken}`,
                    Accept: "application/vnd.github+json",
                    "User-Agent": "zap-worker",
                },
                timeout: 5000
            }
        );
    },

    add_label: async (data: any) => {
        const { payload, actionConfig, githubToken } = data;
        const { owner, repo, issueNumber } = extractRepoInfo(payload);

        await axios.post(
            `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/labels`,
            { labels: [actionConfig.label] },
            {
                headers: {
                    Authorization: `token ${githubToken}`
                },
                timeout: 5000
            }
        );
    },

    assign_reviewer: async (data: any) => {
        const { payload, actionConfig, githubToken } = data;
        const { owner, repo, prNumber } = extractRepoInfo(payload);

        if (!prNumber) return;

        await axios.post(
            `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/requested_reviewers`,
            { reviewers: actionConfig.reviewers },
            {
                headers: {
                    Authorization: `token ${githubToken}`
                },
                timeout: 5000
            }
        );
    },

    close_issue: async (data: any) => {
        const { payload, githubToken } = data;
        const { owner, repo, issueNumber } = extractRepoInfo(payload);

        await axios.patch(
            `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`,
            { state: "closed" },
            {
                headers: {
                    Authorization: `token ${githubToken}`
                },
                timeout: 5000
            }
        );
    },

    call_webhook: async (data: any) => {
        const { actionConfig, payload } = data;

        await axios({
            method: (actionConfig.method || "POST").toUpperCase(),
            url: actionConfig.url,
            headers: actionConfig.headers || {},
            data: payload,
            timeout: 5000
        });
    }
};

async function executeWithRetry(
    handler: ActionHandler,
    data: ActionData,
    zapRunId: string,
    maxRetries = 3
) {
    const baseDelay = 1000;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            await handler(data);

            await prisma.zapRun.update({
                where: { id: zapRunId },
                data: {
                    status: "success",
                    retryCount: attempt
                }
            });

            return;

        } catch (err: any) {

            if (attempt === maxRetries) {
                await prisma.zapRun.update({
                    where: { id: zapRunId },
                    data: {
                        status: "failed",
                        retryCount: attempt,
                        errorMessage: err.message
                    }
                });
                throw err;
            }

            await prisma.zapRun.update({
                where: { id: zapRunId },
                data: {
                    status: "retrying",
                    retryCount: attempt + 1,
                    errorMessage: err.message
                }
            });

            const delay = baseDelay * Math.pow(2, attempt);
            await sleep(delay);
        }
    }
}

async function main() {
    await consumer.connect();
    await consumer.subscribe({ topic: "zap-actions", fromBeginning: false });

    await consumer.run({
        eachMessage: async ({ message }) => {
            try {
                if (!message.value) return;

                const data: ActionData = JSON.parse(message.value.toString());

                const zapRun = await prisma.zapRun.create({
                    data: {
                        zapId: data.zapId,
                        status: "pending",
                        metadata: data.payload
                    }
                });

                const handler = actionHandlers[data.actionType];

                if (!handler) {
                    throw new Error(`Unsupported action type: ${data.actionType}`);
                }

                await executeWithRetry(handler, data, zapRun.id);
            } catch (err: any) {
                console.log("Worker processing failed: ", err);
            }
        }
    });
}

main().catch(console.error);
