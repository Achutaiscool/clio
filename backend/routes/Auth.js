import jwt from "jsonwebtoken"
import bcrypt from "bcrypt"
import User from "../models/User.js"
import z from "zod"
import rateLimit from "express-rate-limit"
import { Router } from "express"

const router = Router()

const SALT_ROUNDS=12

const registerSchema=z.object({
    username:z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
    email:z.string().email().toLowerCase(),
    password:z.string().min(8).max(100),
    dateOfBirth:z.string().datetime().optional()
})

const loginSchema=z.object({
    username:z.string().min(1),
    password:z.string().min(1)
})

const authLimiter=rateLimit({
    windowMs: 15*60*1000,
    max:1000000,
    message:{success:false,error : "Too many atempts. Try again later."}
})

router.post('/register',authLimiter,async(req,res,next)=>{
    try{
        const{username,email,password,dateOfBirth}=registerSchema.parse(req.body)
        const exisiting=await User.findOne({$or:[ {username}, {email} ]})

        if(exisiting){
            const field=exisiting.username===username.toLowerCase()?'Username':'Email'
            return res.status(409).json({success: false,error:`${field} already exists`})
        }

        const passwordHash=await bcrypt.hash(password, SALT_ROUNDS)

        const newUser= await User.create({
            username,
            displayUsername:username,
            email,
            passwordHash,
            dateOfBirth: dateOfBirth ? new Date(dateOfBirth): undefined
        })

        res.status(201).json({
            success:true, 
            data:{
                userId:newUser._id,
                username: newUser.displayUsername
            }
        })
    }
    catch(err){
        next(err)
    }
})

router.post('/login',authLimiter,async(req,res,next)=>{
    try{
    const { username, password}= loginSchema.parse(req.body)
    const user=await User.findOne({username:username})

    if(!user){
        return res.status(401).json({success:false, error:'Invalid credentials'})
    }

    const isPasswordValid= await bcrypt.compare(password,user.passwordHash)

    if(!isPasswordValid){                                         
        return res.status(401).json({success:false, error:'Invalid credentials'})
    }
    const token=jwt.sign(
        {userId:user._id.toString(),username: user.username},
        process.env.JWT_SECRET,
        {expiresIn:'1h'}
    )

    res.json({success: true, data: {token}})

    }
    catch(err){
        next(err)
    }
})

export default router 