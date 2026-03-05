import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

await prisma.availableTrigger.createMany({
    data: [
        { app: "github", name: "issues" },
        { app: "github", name: "pull_request" }
    ],
    skipDuplicates: true
});
console.log("Done seeding availableTriggers!");

await prisma.availableAction.createMany({
    data: [
        { app: "github", name: "create_comment" },
        { app: "github", name: "add_label" },
        { app: "github", name: "assign_reviewer" },
        { app: "github", name: "close_issue" },
        { app: "github", name: "call_webhook" }
    ],
    skipDuplicates: true
});
console.log("Done seeding availableActions!");  