import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import User from "../models/user.model.js";
import env from "../config/env.js";

const register = async (data) => {
  const hashedPassword = await bcrypt.hash(data.password, 10);

  const user = await User.create({
    ...data,
    password: hashedPassword
  });

  return user;
};

const login = async ({ email, password }) => {
  const user = await User.findOne({ email });

  if (!user) throw new Error("User not found");

  const validPassword = await bcrypt.compare(password, user.password);

  if (!validPassword) throw new Error("Invalid password");

  const token = jwt.sign(
    { id: user._id, role: user.role },
    env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  return { user, token };
};

export default { register, login };