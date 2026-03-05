"use client";

import { useRouter } from "next/navigation";

export default function Page() {
    const route = useRouter();

    return (
        <div>
            Choose one :
            <div>
                <button onClick={() => route.push("/signup")}>signup</button>
            </div>
            <div>
                <button onClick={() => route.push("login")}>login</button>
            </div>
        </div>
    );
}