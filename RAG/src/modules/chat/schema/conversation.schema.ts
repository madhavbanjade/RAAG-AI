import mongoose from "mongoose";
export const conversationSchema = new mongoose.Schema({
    title:{
        type: String,
        required: true
    },
    userId:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User", 
        required: true
    },
    isArchived: {
    type: Boolean,
    default: false,
},
},
{
    timestamps: true
}

)


export interface Conversation extends mongoose.Document{
    _id: mongoose.Types.ObjectId;
    title: string;
    userId: mongoose.Types.ObjectId;
    isArchived: boolean;
    createdAt: Date;
    updatedAt: Date;
}