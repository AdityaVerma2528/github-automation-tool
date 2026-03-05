import axios from "axios"; 

export async function getUserRepos(accessToken: string) { 
    const res = await axios.get("https://api.github.com/user/repos", { 
        headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.github+json",
        },
        params: { 
            per_page: 100, 
        }, 
    }); 
    return res.data;
}