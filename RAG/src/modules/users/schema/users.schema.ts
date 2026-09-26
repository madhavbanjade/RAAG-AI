import mongoose from "mongoose";


export const userSchema =  new mongoose.Schema(
    {
        name:{
            type: String,
            required: [true, "The Name is required !"]
        },
        email:{
            type: String,
            required: true
        },
        password:{
            type: String,
            required: true
        },
        role:{
            type: String,
            enum: ["admin", "user"],
            required: true
        },
        isEmailVerified:{
            type: Boolean,
            default: false
        },
        registerOtp:{
            type: String,
            default: null
        },
        registerOtpExpires:{
            type: Date,
            default: null
        },
        resetOtp :{
            type: String,
            default: null
        },
        resetOtpExpires:{
            type: Date,
            default: null
        }
    
    }
)


//Exporting the model interface for injection
export interface User extends mongoose.Document {
    _id: mongoose.Types.ObjectId;
    name: string;
    email: string;
    password: string;
    role: string;
    isEmailVerified: boolean;
    registerOtp: string | null;
    registerOtpExpires: Date | null;
    resetOtp: string | null;
    resetOtpExpires: Date | null;
}