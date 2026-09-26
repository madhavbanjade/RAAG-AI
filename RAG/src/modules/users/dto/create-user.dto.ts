import { IsEnum, IsNotEmpty, IsString, Matches, MaxLength, MinLength } from "class-validator";

export class CreateUserDto {


    @IsNotEmpty({message: "User name is required"})
    @IsString()
    @MinLength(3, {message: "Name must be at least 3 character long"})
    @MaxLength(100, {message: "Name must not exceed 100 character"})
    name!: string;


    @IsNotEmpty({message: "Email is required"})
    @IsString()
      @Matches(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, {
    message: "Please provide a valid email address",
  })
    email!: string ;

@IsNotEmpty({message: "Password is required"})
@IsString()
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/, {
    message: "Password must contain at least 8 characters, one uppercase, one lowercase, one number, and one special character (@$!%*?&)",
  })
    password!: string ;

@IsNotEmpty({message: "Role is required"})
@IsString()
  @IsEnum(["admin", "user"], {
    message: "Please provide a valid role for the user.",
  })
role!: string;

}

export class RegisterDto {
    @IsNotEmpty({message: "Name is required"})
    @IsString()
    @MinLength(3, {message: "Name must be at least 3 character long"})
    @MaxLength(100, {message: "Name must not exceed 100 character"})
    name!: string;

    @IsNotEmpty({message: "Email is required"})
    @IsString()
    @Matches(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, {
      message: "Please provide a valid email address",
    })
    email!: string;

    @IsNotEmpty({message: "Password is required"})
    @IsString()
    @MinLength(6, {message: "Password must be at least 6 characters long"})
    password!: string;
}

export class LoginDto {
    @IsNotEmpty({message: "Email is required"})
    @IsString()
    @Matches(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, {
      message: "Please provide a valid email address",
    })
    email!: string;

    @IsNotEmpty({message: "Password is required"})
    @IsString()
    password!: string;
}


