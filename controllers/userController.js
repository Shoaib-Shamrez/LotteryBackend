import bcrypt from "bcrypt";
import {
  getAllUsers,
  getUserByEmail,
  createUser,
  deleteUser,
  updateUser,
  CountSubs,
} from "../models/userModel.js";

export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  // Validate input more strictly
  if (
    !email ||
    !password ||
    typeof email !== "string" ||
    typeof password !== "string"
  ) {
    return res
      .status(400)
      .json({ message: "Valid email and password are required" });
  }

  if (password.trim() === "") {
    return res.status(400).json({ message: "Password cannot be empty" });
  }

  try {
    // Get user by email
    const user = await getUserByEmail(email);
    if (!user) {
      return res.status(401).json({
        message: `Invalid email or password with this email ${email}`,
      });
    }

    // Check if user has a password hash
    if (!user.password) {
      console.error(
        "User found but no password hash in database for email:",
        email
      );
      return res.status(500).json({ message: "Account configuration error" });
    }

    // Debug logging
    console.log("Login attempt for:", email);
    console.log("User found:", {
      id: user.id,
      email: user.email,
      hasPassword: !!user.password,
    });

    // Compare provided password with hashed password in database
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // If password is valid, return user data (without password)
    const { password: _, ...userWithoutPassword } = user;

    res.status(200).json({
      message: "Login successful",
      user: userWithoutPassword,
    });
  } catch (err) {
    console.error("Login error:", err);

    // More specific error messages
    if (err.message.includes("data and hash arguments required")) {
      console.error("BCrypt error - likely missing password data");
      return res.status(500).json({ message: "Authentication system error" });
    }

    res.status(500).json({ error: "Internal server error" });
  }
};

export const getUsers = async (req, res) => {
  try {
    const users = await getAllUsers();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const userUpdate = async (req, res) => {
  const { id } = req.params;
  const { name, email, password, role } = req.body;

  try {
    let hashedPassword;

    // Only hash password if it's provided and not empty
    if (password && password.trim() !== "") {
      const saltRounds = 12;
      hashedPassword = await bcrypt.hash(password, saltRounds);
    }

    const result = await updateUser(name, email, hashedPassword, role, id);

    res
      .status(200)
      .json({ message: "User updated successfully", user: result });
  } catch (error) {
    console.error("Error updating User:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getUser = async (req, res) => {
  const { email } = req.params;
  try {
    const user = await getUserByEmail(email);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const addUser = async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  if (password.trim() === "") {
    return res.status(400).json({ message: "Password cannot be empty" });
  }

  try {
    // Hash password before creating user
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const newUser = await createUser(name, email, hashedPassword, role);

    // Remove password from response
    const { password: _, ...userWithoutPassword } = newUser;

    res.status(201).json(userWithoutPassword);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const removeUser = async (req, res) => {
  try {
    await deleteUser(req.params.id);
    res.json({ message: "User deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
export const getSubscriberCount = async (req, res) => {
  try {
    const count = await CountSubs();
    res.json({ total_subscribers: count.total_subscribers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
