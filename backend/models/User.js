import mongoose from"mongoose"
import { minLength } from "zod"

const userSchema= new mongoose.Schema({

    username: { 
        type:String, 
        required:true,
        unique:true, 
        trim:true,
        lowercase:true,
        minlength:[3,"Usernames must be 3 atleast 3 characters"],
        maxlength:[30,"Username must be at least 30 characters"],
        match:[/^[a-z0-9_]+$/,"Usernames can only contain lowercase letters, numbers and underscores."]
    },
    displayUsername:{
        type:String,
        required:[true,'display username is required'],
        trim:true,
        maxlength:[30,"display username must be at most 30 characters"]
    },
    email: { 
        type:String ,
        required:true,
        unique:true, 
        trim:true,
        lowercase:true,
        match:[/^\S+@\S+\.\S+$/, "Please enter a valid email address"] 
    },
    passwordHash: { 
        type:String, 
        required:true,
    },
    dateOfBirth:{
        type: Date
    },
},
    {
        timestamp:true
    }
    
)

export default mongoose.model('User', userSchema)