import mysql from "mysql2";

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  port: 3306,
  password: "",
  database: "lottery_system",
});

db.connect((err) => {
  if (err) {
    console.error("Database connection failed:", err.message);
  } else {
    console.log("MySQL connected successfully");
  }
});

export default db;
