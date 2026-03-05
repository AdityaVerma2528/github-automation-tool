import { Router, type Request, type Response } from "express"; 
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken"; 

const prisma = new PrismaClient(); 

export const auth = Router(); 

async function signup(req: Request, res: Response): Promise<Response> { 
    try { 
        const { email, password } = req.body;
        
        if(!email || !password) { 
            return res.status(400).json({ "message": "All the fields are required!" }); 
        }

        await prisma.user.create({
            data: { 
                email, 
                password
            },
        }); 

        return res.status(200).json({ "message": "Signup done!" });
    } catch (error: any) { 
        console.log(error); 
        return res.status(500).json({ "error": "Internal server error!" }); 
    }
}

async function login (req: Request, res: Response): Promise<Response> { 
    try { 
        const { email, password } = req.body; 

        if(!email || !password) { 
            return res.status(400).json({ "message": "All the fields are required!" }); 
        }

        const user = await prisma.user.findUnique({ where: { email } }); 

        if (!user) { 
            return res.status(401).json({ "message": "Invalid Email!" }); 
        }

        if (user.password !== password) { 
            return res.status(401).json({ "message": "Invalid Password" }); 
        }
        
        const payload = { 
            userId: user.id,
            email: user.email,
        }; 

        const token = jwt.sign(payload, process.env.JWT_SECRET || "", { 
            expiresIn: "1h",
        }); 

        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production", // only true in prod (HTTPS)
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        });

        return res.status(200).json({ "message": "Login done!" }); 
    } catch (error: any) { 
        console.log(error); 
        return res.status(500).json({" error": "Internal server error! "}); 
    }
}

auth.post("/login", login); 
auth.post("/signup", signup); 