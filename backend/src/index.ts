import express from "express"; 
import { type Request, type Response } from "express"; 
import cors from "cors"; 
import { PrismaClient } from "@prisma/client";
import cookieParser from "cookie-parser"; 
import { auth } from "./routes/auth.js";
import { authMiddleware } from "./middleware/authMiddleware.js";
import axios from "axios";
import { isTokenValid } from "./utils/isTokenValid.js";
import { Kafka } from "kafkajs"; 
// import { getUserRepos } from "./utils/getUserRepos.js";

const app = express(); 

app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true })); 
app.use(express.json()); 
app.use(cookieParser());
app.use("/api/v1/auth", auth);

const prisma = new PrismaClient(); 

const kafka = new Kafka({ 
    clientId: "webhook-service", 
    brokers: ["localhost:9092"], 
}); 

const producer = kafka.producer(); 
await producer.connect(); 

app.get("/api/v1/auth/github", authMiddleware, (req: Request, res: Response) => {
    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&redirect_uri=${process.env.GITHUB_REDIRECT_URI}&scope=repo`;
    res.redirect(githubAuthUrl);
});

app.get("/api/v1/auth/github/callback", authMiddleware, async (req: Request, res: Response) => { 
    //@ts-ignore
    const userId = req.userId; 
    const code = req.query.code; 

    if(!code) { 
        return res.status(400).json({ "error": "No code provided" }); 
    }

    try { 
        const tokenResponse = await axios.post("https://github.com/login/oauth/access_token", 
            { 
                client_id: process.env.GITHUB_CLIENT_ID, 
                client_secret: process.env.GITHUB_CLIENT_SECRET, 
                code: code, 
                redirect_uri: process.env.GITHUB_REDIRECT_URI, 
            }, 
            { headers: { Accept: "application/json" } }
        ); 

        const accessToken = tokenResponse.data.access_token; 

        await prisma.tokens.create({
            data: {
                userId, 
                provider: "github", 
                accessToken, 
            }, 
        }); 

        res.redirect(`http://localhost:3000/createZap`); 
    } catch (error: any) {
        console.error(error); 
        res.status(500).json( {"error": "Authentication failed" }); 
    }
}); 

app.get("/api/v1/github/check-connection", authMiddleware, async (req: Request, res: Response) => { 
    //@ts-ignore
    const userId = req.userId; 

    try {
        const data = await prisma.tokens.findFirst({
            where: { 
                userId, 
                provider: "github", 
            },
        });
        
        const token = data?.accessToken; 

        if (!token) { 
            return res.status(404).json({ "message": "Token not found!" }); 
        }

        const valid = await isTokenValid(token); 

        if(valid) { 
            return res.status(200).json({ "message": "Token is valid" }); 
        } else { 
            return res.status(400).json({ "message": "Token is not valid" }); 
        }
    } catch (error: any) { 
        console.error(error); 
        return res.status(500).json({ "message": "Internal server error" }); 
    }
});

app.get("/api/v1/github/get-repositories", authMiddleware, async (req: Request, res: Response) => {
    //@ts-ignore
    const userId = req.userId; 

    try { 
        const data = await prisma.tokens.findFirst({
            where: { 
                userId,
                provider: "github", 
            }
        }); 

        if (!data || !data.accessToken) {
            return res.status(401).json({
                message: "GitHub not connected"
            });
        }

        const ghres = await axios.get("https://api.github.com/user/repos", {
            headers: {
                Authorization: `token ${data.accessToken}`, 
                Accept: "application/vnd.github+json", 
            }, 
            params: {
                per_page: 50, 
                sort: "updated", 
            },
        }); 

        return res.status(200).json(ghres.data);
    } catch (error: any) { 
        console.error("GitHub repo fetch error:", error.response?.data || error.message);

        return res.status(500).json({
            message: "Failed to fetch repositories"
        });
    }
});

app.get("/api/v1/github/get-triggers", authMiddleware, async (req: Request, res: Response) => { 
    try { 
        const availableTriggers = await prisma.availableTrigger.findMany({
            where: { app: "github" }, 
        }); 
        return res.status(200).json(availableTriggers); 
    } catch (error: any) {   
        console.error(error); 
        return res.status(500).json({ "message": "Internal server error" }); 
    }
}); 

app.get("/api/v1/github/get-actions", authMiddleware, async (req: Request, res: Response) => { 
    try { 
        const availableActions = await prisma.availableAction.findMany({
            where: { app: "github" }, 
        }); 
        return res.status(200).json(availableActions); 
    } catch (error: any) {   
        console.error(error); 
        return res.status(500).json({ "message": "Internal server error" }); 
    }
}); 

app.post("/api/v1/github/set-zap", authMiddleware, async (req: Request, res: Response) => { 
    try {
        //@ts-ignore 
        const userId = req.userId; 
        const { eventName, eventAction, repository, actionName, actionConfig } = req.body.formData; 
        
        if(!eventName || !eventAction || !repository || !actionName ||!actionConfig) { 
            return res.status(400).json({ "message": "All the fields are required" }); 
        }

        const tokenRow = await prisma.tokens.findFirst({ 
            where: {
                userId: userId, 
                provider: "github", 
            }, 
        }); 

        if (!tokenRow) { 
            return res.status(401).json({ "message": "Github not connected" }); 
        }

        const zap = await prisma.zap.create({
            data: { 
                userId, 
            },
        });
        
        await prisma.trigger.create({ 
            data: { 
                zapId: zap.id, 
                eventName, 
                eventAction, 
                availableTriggerName: eventName
            }, 
        }); 

        await prisma.action.create({ 
            data: { 
                zapId: zap.id, 
                availableActionName: actionName, 
                actionConfig, 
            }, 
        }); 

        const [owner, repo] = repository.split("/"); 

        // TODO: Add GitHub webhook signature verification
        const webhookRes = await axios.post(
            `https://api.github.com/repos/${owner}/${repo}/hooks`,
            {
                name: "web",
                active: true,
                events: [eventName],
                config: {
                    url: `${process.env.GITHUB_WEBHOOK_URL}`,  
                    content_type: "json",
                    insecure_ssl: "0",
                },
            },
            { headers: { Authorization: `token ${tokenRow.accessToken}` } }
        );

        await prisma.webhook.create({
            data: {
                zapId: zap.id,
                webhookId: webhookRes.data.id,
                repository,
            },
        });

        return res
            .status(200)
            .json({ message: "Zap created successfully" });
    } catch (error: any) {
        console.error(error);
        return res.status(500).json({ message: "Internal server error" });
    }

}); 

//After trigger happens 
app.post("/api/v1/github/webhooks", async (req, res) => {
    try {
        const eventName = req.headers["x-github-event"] as string;
        const deliveryId = req.headers["x-github-delivery"] as string; 

        const payload = req.body;
        const eventAction = payload.action; 

        if (!deliveryId) {
            return res.status(400).json({ message: "Missing delivery ID" });
        }

        const alreadyProcessed = await prisma.webhookDelivery.findUnique({
            where: {
                id: deliveryId
            }
        }); 

        if (alreadyProcessed) {
            return res.status(200).json({ message: "Duplicate webhook" });
        }

        await prisma.webhookDelivery.create({ 
            data: { 
                id: deliveryId
            }
        }); 

        const zaps = await prisma.zap.findMany({
            where: {
                trigger: {
                    eventName, 
                    eventAction
                },
                webhook: {
                    repository: payload.repository.full_name,
                },
            },
            include: {
                actions: true,
                trigger: true,
                user: {
                    select: {
                        tokens: {
                            where: {
                                provider: "github",
                            },
                            select: {
                                accessToken: true,
                            },
                        },
                    },
                },
            },
        });

        for (const zap of zaps) {
            const githubToken = zap.user.tokens[0]?.accessToken;

            for (const action of zap.actions) {
                await producer.send({
                    topic: "zap-actions",
                    messages: [
                        {
                            key: zap.id,
                            value: JSON.stringify({
                                zapId: zap.id,
                                actionId: action.id,
                                actionType : action.availableActionName,
                                actionConfig: action.actionConfig, 
                                payload,
                                githubToken,
                            }),
                        },
                    ],
                });
            }
        }
        res.status(200).json({
            message: "Webhook processed",
            matchedZaps: zaps.length,
        });
    } catch (error: any) {
        console.error("Webhook processing error: ", error);
        return res.status(500).json({ message: "Internal sever error" });
    }
});

app.listen(5000, () => { 
    console.log("Server is running on port 5000"); 
}); 
