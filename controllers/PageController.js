import fs from "fs";
import path from "path";

const filePath = path.resolve("data/pages.json");

// ✅ Helper to read JSON
const readPagesFile = () => {
  const data = fs.readFileSync(filePath, "utf8");
  return JSON.parse(data);
};

// ✅ Helper to write JSON
const writePagesFile = (data) => {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

// ✅ Get all pages
export const getPages = (req, res) => {
  try {
    const pages = readPagesFile();
    res.json(pages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ Get single page by slug
export const getPage = (req, res) => {
  try {
    const pages = readPagesFile();
    const page = pages[req.params.slug];
    if (!page) return res.status(404).json({ message: "Page not found" });
    res.json(page);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ Add new static page
export const addPage = (req, res) => {
  try {
    const { slug, title, content } = req.body;
    const pages = readPagesFile();

    if (pages[slug]) {
      return res.status(400).json({ message: "Slug already exists" });
    }

    pages[slug] = { title, content };
    writePagesFile(pages);

    res.status(201).json({ message: "Page added successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ Update existing static page
export const updatePage = (req, res) => {
  try {
    const { title, content } = req.body;
    const { slug } = req.params;
    const pages = readPagesFile();

    if (!pages[slug]) {
      return res.status(404).json({ message: "Page not found" });
    }

    pages[slug] = { title, content };
    writePagesFile(pages);

    res.json({ message: "Page updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ Delete static page
export const removePage = (req, res) => {
  try {
    const { slug } = req.params;
    const pages = readPagesFile();

    if (!pages[slug]) {
      return res.status(404).json({ message: "Page not found" });
    }

    delete pages[slug];
    writePagesFile(pages);

    res.json({ message: "Page deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
