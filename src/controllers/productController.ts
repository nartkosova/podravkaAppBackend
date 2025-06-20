import { Request, Response } from "express";
import db from "../models/db";
import { QueryError, RowDataPacket, OkPacket } from "mysql2";

export const getProducts = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { category } = req.query;

    let query = "SELECT * FROM podravka_products";
    const queryParams: any[] = [];

    if (category) {
      query += " WHERE category = ?";
      queryParams.push(category);
    }

    const [products] = await db
      .promise()
      .query<RowDataPacket[]>(query, queryParams);

    if (products.length === 0) {
      res.status(404).json({ error: "No products found" });
      return;
    }

    res.json(products);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getCompetitorProducts = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { category, competitor_id } = req.query;

    let query = "SELECT * FROM competitor_products WHERE 1=1";
    const params: any[] = [];

    if (category) {
      query += " AND category = ?";
      params.push(category);
    }

    if (competitor_id) {
      query += " AND competitor_id = ?";
      params.push(competitor_id);
    }

    const [products] = await db.promise().query<RowDataPacket[]>(query, params);

    if (!products.length) {
      res.status(404).json({ error: "Nuk ka produkte te konkurrences!" });
      return;
    }

    res.status(200).json(products);
  } catch (error) {
    console.error("Error fetching competitor products:", error);
    res.status(500).json({ error: "Server Error" });
  }
};

export const createProduct = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { category, name, podravka_code, elkos_code, product_category } =
      req.body;

    const user = req.user; // from middleware
    if (!user || !user.user_id) {
      res.status(401).json({ error: "Nuk jeni te autoreziaur" });
      return;
    }

    if (!category || !name || !podravka_code || !product_category) {
      res.status(400).json({ error: "All required fields must be provided!" });
      return;
    }

    const query = `
      INSERT INTO podravka_products 
        (category, name, podravka_code, elkos_code, product_category) 
      VALUES (?, ?, ?, ?, ?)
    `;

    const [result] = await db
      .promise()
      .query(query, [
        category,
        name,
        podravka_code,
        elkos_code,
        product_category,
      ]);

    const insertId = (result as any).insertId;

    res
      .status(201)
      .json({ id: insertId, message: "Product added successfully!" });
  } catch (error) {
    console.error("Error adding product:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const createCompetitorProduct = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = req.user;
    if (!user || !user.user_id) {
      res.status(401).json({ error: "Nuk jeni te autoreziaur" });
      return;
    }

    const { competitor_id, name, category, weight } = req.body;

    if ("created_by" in req.body && req.body.created_by !== user.user_id) {
      res.status(403).json({
        error: "Manual assignment of created_by is not allowed.",
      });
      return;
    }

    if (!competitor_id || !name || !category) {
      res.status(400).json({
        error: "competitor_id, name, and category are required!",
      });
      return;
    }

    const query = `
      INSERT INTO competitor_products
        (competitor_id, name, category, weight, created_by)
      VALUES (?, ?, ?, ?, ?)
    `;

    const [result] = await db
      .promise()
      .query<OkPacket>(query, [
        competitor_id,
        name,
        category,
        weight ?? null,
        user.user_id,
      ]);

    res.status(201).json({
      id: result.insertId,
      message: "Competitor product added successfully!",
    });
  } catch (error) {
    console.error("Error adding competitor product:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const updateCompetitorProduct = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { product_id } = req.params;
    const { name, category, weight } = req.body;
    if (!name || !category) {
      res.status(400).json({ error: "Emri dhe kategoria nevojiten" });
      return;
    }
    const query =
      "UPDATE competitor_products SET name = ?, category = ?, weight = ? WHERE competitor_product_id = ?";
    const [result] = await db
      .promise()
      .query<OkPacket>(query, [name, category, weight ?? null, product_id]);
    if (result.affectedRows === 0) {
      res.status(404).json({ error: "Produkti i konkurrences nuk egziston" });
      return;
    }
    res.json({ message: "Produkti i konkurrences u perditsua me sukses" });
  } catch (error) {
    console.error("Error updating competitor product:", error);
    res.status(500).json({ error: "Server Error" });
  }
};

export const deleteCompetitorProduct = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { product_id } = req.params;
    const query =
      "DELETE FROM competitor_products WHERE competitor_product_id = ?";
    const [result] = await db.promise().query<OkPacket>(query, [product_id]);
    if (result.affectedRows === 0) {
      res.status(404).json({ error: "Produkti i konkurrences nuk egziston" });
      return;
    }
    res.json({ message: "Produkti i konkurrences eshte fshire me sukses" });
  } catch (error) {
    console.error("Error deleting competitor product:", error);
    res.status(500).json({ error: "Server Error" });
  }
};
