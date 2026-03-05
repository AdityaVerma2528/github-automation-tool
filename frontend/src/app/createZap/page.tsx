"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { Github, Zap } from "lucide-react";
import axios from "axios";
import { useRouter } from "next/navigation";

type ActionConfig = {
    body?: string;
    label?: string;
    reviewers?: string[];
    url?: string;
    method?: string;
};

export default function CreateZap() {
    const baseUrl = "http://localhost:5000/api/v1";
    const router = useRouter();

    const [isConnected, setIsConnected] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [repositories, setRepositories] = useState<{ full_name: string }[]>([]);
    const [availableTriggers, setAvailableTriggers] = useState<{ name: string }[]>([]);
    const [availableActions, setAvailableActions] = useState<{ name: string }[]>([]);

    const [formData, setFormData] = useState({
        eventName: "",
        eventAction: "",
        repository: "",
        actionName: "",
        actionConfig: {} as ActionConfig
    });

    /* ------------------ CHECK GITHUB CONNECTION ------------------ */
    useEffect(() => {
        const checkConnection = async () => {
            try {
                await axios.get(`${baseUrl}/github/check-connection`, {
                    withCredentials: true
                });
                setIsConnected(true);
            } catch {
                setIsConnected(false);
            }
        };
        checkConnection();
    }, []);

    /* ------------------ FETCH DATA ------------------ */
    useEffect(() => {
        if (!isConnected) return;

        const fetchData = async () => {
            const [repos, triggers, actions] = await Promise.all([
                axios.get(`${baseUrl}/github/get-repositories`, { withCredentials: true }),
                axios.get(`${baseUrl}/github/get-triggers`, { withCredentials: true }),
                axios.get(`${baseUrl}/github/get-actions`, { withCredentials: true })
            ]);

            setRepositories(repos.data);
            setAvailableTriggers(triggers.data);
            setAvailableActions(actions.data);
        };

        fetchData();
    }, [isConnected]);

    /* ------------------ HANDLERS ------------------ */
    const updateField = (key: string, value: any) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    const updateActionConfig = (key: keyof ActionConfig, value: any) => {
        setFormData(prev => ({
            ...prev,
            actionConfig: {
                ...prev.actionConfig,
                [key]: value
            }
        }));
    };

    const handleConnect = () => {
        window.location.href = `${baseUrl}/auth/github`;
    };

    const handleCreateZap = async () => {
        if (
            !formData.eventName ||
            !formData.eventAction ||
            !formData.repository ||
            !formData.actionName
        ) {
            alert("Please complete all required fields");
            return;
        }

        try {
            setIsSubmitting(true);

            console.log(formData); 
            await axios.post(
                `${baseUrl}/github/set-zap`,
                { formData },
                { withCredentials: true }
            );

            router.push("/");
        } catch (err) {
            console.error("Failed to create zap:", err);
        } finally {
            setIsSubmitting(false);
        }
    };

    /* ------------------ UI ------------------ */
    return (
        <div className="flex items-center justify-center min-h-screen bg-black p-4">
            <div className="w-full max-w-md bg-white rounded-xl shadow-xl">
                <div className="p-6 border-b">
                    <h2 className="text-2xl font-bold text-gray-900">
                        GitHub Automation Setup
                    </h2>
                    <p className="text-gray-600 mt-1">
                        {isConnected
                            ? "Configure your GitHub workflow"
                            : "Connect GitHub to start creating automations"}
                    </p>
                </div>

                <div className="p-6 space-y-5">
                    {/* CONNECT BUTTON */}
                    {!isConnected && (
                        <button
                            onClick={handleConnect}
                            className="w-full flex items-center justify-center px-4 py-3 bg-gray-900 text-white rounded-md hover:bg-gray-800"
                        >
                            <Github className="w-5 h-5 mr-2" />
                            Connect to GitHub
                        </button>
                    )}

                    {/* FORM */}
                    {isConnected && (
                        <>
                            {/* EVENT */}
                            <div>
                                <label className="block text-sm font-medium mb-1">
                                    Event
                                </label>
                                <select
                                    className="w-full border px-3 py-2 rounded text-black"
                                    value={formData.eventName}
                                    onChange={(e) => updateField("eventName", e.target.value)}
                                >
                                    <option value="">Select Event</option>
                                    {availableTriggers.map(t => (
                                        <option key={t.name} value={t.name}>
                                            {t.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* EVENT ACTION */}
                            <div>
                                <label className="block text-sm font-medium mb-1">
                                    Event Action
                                </label>
                                <select
                                    className="w-full border px-3 py-2 rounded text-black"
                                    value={formData.eventAction}
                                    onChange={(e) => updateField("eventAction", e.target.value)}
                                >
                                    <option value="">Select Action Type</option>
                                    <option value="opened">opened</option>
                                    <option value="closed">closed</option>
                                    <option value="synchronize">synchronize</option>
                                </select>
                            </div>

                            {/* REPOSITORY */}
                            <div>
                                <label className="block text-sm font-medium mb-1">
                                    Repository
                                </label>
                                <select
                                    className="w-full border px-3 py-2 rounded text-black"
                                    value={formData.repository}
                                    onChange={(e) => updateField("repository", e.target.value)}
                                >
                                    <option value="">Select Repository</option>
                                    {repositories.map(r => (
                                        <option key={r.full_name} value={r.full_name}>
                                            {r.full_name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* ACTION */}
                            <div>
                                <label className="block text-sm font-medium mb-1">
                                    Action
                                </label>
                                <select
                                    className="w-full border px-3 py-2 rounded text-black"
                                    value={formData.actionName}
                                    onChange={(e) => {
                                        updateField("actionName", e.target.value);
                                        updateField("actionConfig", {});
                                    }}
                                >
                                    <option value="">Select Action</option>
                                    {availableActions.map(a => (
                                        <option key={a.name} value={a.name}>
                                            {a.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* DYNAMIC ACTION CONFIG */}

                            {formData.actionName === "create_comment" && (
                                <textarea
                                    rows={4}
                                    placeholder="Comment message"
                                    className="w-full border px-3 py-2 rounded text-black"
                                    onChange={(e) =>
                                        updateActionConfig("body", e.target.value)
                                    }
                                />
                            )}

                            {formData.actionName === "add_label" && (
                                <input
                                    placeholder="Label name (e.g., bug)"
                                    className="w-full border px-3 py-2 rounded text-black"
                                    onChange={(e) =>
                                        updateActionConfig("label", e.target.value)
                                    }
                                />
                            )}

                            {formData.actionName === "assign_reviewer" && (
                                <input
                                    placeholder="Reviewers (comma separated)"
                                    className="w-full border px-3 py-2 rounded text-black"
                                    onChange={(e) =>
                                        updateActionConfig(
                                            "reviewers",
                                            e.target.value.split(",").map(r => r.trim())
                                        )
                                    }
                                />
                            )}

                            {formData.actionName === "call_webhook" && (
                                <>
                                    <input
                                        placeholder="Webhook URL"
                                        className="w-full border px-3 py-2 rounded text-black"
                                        onChange={(e) =>
                                            updateActionConfig("url", e.target.value)
                                        }
                                    />
                                    <input
                                        placeholder="HTTP Method (POST, GET...)"
                                        className="w-full border px-3 py-2 rounded text-black mt-2"
                                        onChange={(e) =>
                                            updateActionConfig("method", e.target.value)
                                        }
                                    />
                                </>
                            )}

                            {/* SUBMIT */}
                            <button
                                onClick={handleCreateZap}
                                disabled={isSubmitting}
                                className="w-full flex items-center justify-center px-4 py-3 bg-yellow-500 text-black font-semibold rounded-md hover:bg-yellow-400 mt-4"
                            >
                                {isSubmitting ? (
                                    "Creating..."
                                ) : (
                                    <>
                                        <Zap className="w-5 h-5 mr-2" />
                                        Create Automation
                                    </>
                                )}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}