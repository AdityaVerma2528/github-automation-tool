import axios from "axios"; 

export async function isTokenValid(token: string): Promise<boolean> { 
    try { 
        const res = await axios.get("https://api.github.com/user", { 
            headers: { Authorization: `token ${token}` }, 
        }); 

        return res.status === 200; 
    } catch (error: any) { 
        if (error.response && (error.response.status === 401 || error.response.status === 403)) { 
            return false; 
        }
        throw error; 
    }
}