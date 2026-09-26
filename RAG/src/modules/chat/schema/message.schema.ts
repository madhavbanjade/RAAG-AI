import mongoose from "mongoose";



export const messageSchema = new mongoose.Schema({

    conversationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Conversation", 
        required: true
    },
    role:{
        type: String,
        enum : ['user', 'assistant'],
        required: true
    },
    content:{
        type: String,
        required: true
    },
    // Persisted so the Analysis/Sources panels can be rebuilt from history
    // on reload/relogin instead of resetting to zero every time.
    sources: {
        type: [
            {
                documentName: String,
                text: String,
                page: Number,
                score: Number,
                rerankScore: Number,
                _id: false,
            },
        ],
        required: false,
    },
    confidence: {
        type: String,
        enum: ['high', 'medium', 'low'],
        required: false,
    },
    timeMs: {
        type: Number,
        required: false,
    },


},
{
    timestamps: true
}



)



export interface MessageSource {
    documentName?: string;
    text?: string;
    page?: number;
    score?: number;
    rerankScore?: number;
}

export interface Message extends mongoose.Document{
    _id: mongoose.Types.ObjectId;
    conversationId: mongoose.Types.ObjectId;
    role: "user" | "assistant";
    content: string,
    sources?: MessageSource[];
    confidence?: "high" | "medium" | "low";
    timeMs?: number;
    createdAt: Date,
    updatedAt: Date
}