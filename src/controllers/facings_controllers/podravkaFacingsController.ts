import { Request, Response } from "express";
import db from "../../models/db";
import { OkPacket, RowDataPacket } from "mysql2";
import { v4 as uuidv4 } from "uuid";

export const getAllPodravkaFacings = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const query = "SELECT * FROM podravka_facings";
    const [podravka_facings] = await db.promise().query<RowDataPacket[]>(query);
    res.json(podravka_facings);
  } catch (error) {
    console.error("Error fetching podravka facings:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getUserPPLBatches = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user_id = req.user?.user_id;

    if (!user_id) {
      res.status(401).json({ error: "Nuk jeni te autoreziaur" });
      return;
    }

    const query = `
      SELECT 
        pf.batch_id,
        s.store_name,
        pf.category,
        pf.report_date as report_date,
        COUNT(*) as product_count
      FROM podravka_facings pf
      JOIN stores s ON pf.store_id = s.store_id
      WHERE pf.user_id = ? AND batch_id IS NOT NULL
      GROUP BY pf.batch_id, pf.store_id, pf.category, pf.report_date
      ORDER BY pf.report_date DESC
    `;

    const [rows] = await db.promise().query<RowDataPacket[]>(query, [user_id]);
    res.json(rows);
  } catch (error) {
    console.error("Error fetching PPL batches:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const batchCreatePodravkaFacings = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user_id = req.user?.user_id;
    const facings = req.body;

    if (!user_id) {
      res.status(401).json({
        error: "Nuk jeni te autoreziaur.",
      });
      return;
    }

    if (!Array.isArray(facings) || facings.length === 0) {
      res.status(400).json({ error: "Facings array is required!" });
      return;
    }
    const batchId = uuidv4();

    for (const facing of facings) {
      const {
        user_id: payloadUserId,
        store_id,
        product_id,
        category,
        facings_count,
      } = facing;
      if (payloadUserId !== user_id) {
        res.status(403).json({
          error: "You are not authorized to submit facings for another user.",
        });
        return;
      }

      const [storeRows] = await db
        .promise()
        .query<RowDataPacket[]>("SELECT * FROM stores WHERE store_id = ?", [
          store_id,
        ]);

      if (storeRows.length === 0) {
        res.status(404).json({ error: "Shitorja nuk ekziston" });
        return;
      }

      const store = storeRows[0];

      if (store.user_id !== user_id && req.user?.role !== "admin") {
        res.status(403).json({
          error: "You are not allowed to submit facings for this store",
        });
        return;
      }

      if (
        !user_id ||
        !store_id ||
        !product_id ||
        !category ||
        facings_count == null
      ) {
        res
          .status(400)
          .json({ error: "Each facing must have all fields filled!" });
        return;
      }
    }

    const values = facings.map((f) => [
      f.user_id,
      f.store_id,
      f.product_id,
      f.category,
      f.facings_count,
      batchId,
    ]);

    const query =
      "INSERT INTO podravka_facings (user_id, store_id, product_id, category, facings_count, batch_id) VALUES ?";

    const [result] = await db.promise().query<OkPacket>(query, [values]);

    res.status(201).json({
      affectedRows: result.affectedRows,
      message: "Podravka facings batch added successfully!",
    });
  } catch (error) {
    console.error("Error batch adding Podravka facings:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const updatePodravkaFacingsBatch = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user_id = req.user?.user_id;
    const facings = req.body?.facings;
    const batchId = req.body?.batchId;

    if (!user_id) {
      res.status(401).json({ error: "Nuk jeni te autoreziaur." });
      return;
    }

    if (!batchId || !Array.isArray(facings) || facings.length === 0) {
      res
        .status(400)
        .json({ error: "batchId and facings array are required!" });
      return;
    }

    for (const facing of facings) {
      const { user_id: payloadUserId, product_id, facings_count } = facing;

      if (payloadUserId !== user_id) {
        res.status(403).json({
          error: "You are not authorized to update facings for another user.",
        });
        return;
      }

      if (!product_id || facings_count == null) {
        res.status(400).json({
          error: "Each facing must have product_id and facings_count!",
        });
        return;
      }
    }

    const updatePromises = facings.map((f) =>
      db.promise().query(
        `UPDATE podravka_facings 
           SET facings_count = ? 
           WHERE batch_id = ? AND product_id = ? AND user_id = ?`,
        [f.facings_count, batchId, f.product_id, user_id]
      )
    );

    await Promise.all(updatePromises);

    res.status(200).json({
      message: "Facings u perditsuan me sukses!",
    });
  } catch (error) {
    console.error("Error updating facings batch:", error);
    res.status(500).json({ error: "Error ne server" });
  }
};

export const deletePodravkaFacingBatch = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user_id = req.user?.user_id;
    const batchId = req.params.batchId;

    if (!user_id) {
      res.status(401).json({ error: "Nuk jeni te autoreziaur." });
      return;
    }

    if (!batchId) {
      res.status(400).json({ error: "Batch ID is required." });
      return;
    }

    const query = `
      DELETE FROM podravka_facings 
      WHERE batch_id = ? AND user_id = ?`;

    const [result] = await db
      .promise()
      .query<OkPacket>(query, [batchId, user_id]);

    if (result.affectedRows === 0) {
      res.status(404).json({ error: "No facings found for this batch ID." });
      return;
    }

    res.status(200).json({ message: "Facings batch deleted successfully!" });
  } catch (error) {
    console.error("Error deleting facings batch:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getPodravkaFacingsByBatchId = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { batchId } = req.params;
    const user_id = req.user?.user_id;

    if (!batchId) {
      res.status(400).json({ error: "Batch ID is required." });
      return;
    }

    const query = `
    SELECT 
      pf.*,
      u.user AS user,
      s.store_name,
      p.name AS name
    FROM podravka_facings pf
    JOIN users u ON pf.user_id = u.user_id
    JOIN stores s ON pf.store_id = s.store_id
    JOIN podravka_products p ON pf.product_id = p.product_id
    WHERE pf.batch_id = ?
    `;

    const [results] = await db
      .promise()
      .query<RowDataPacket[]>(query, [batchId, user_id]);

    if (results.length === 0) {
      res.status(404).json({ error: "No facings found for this batch ID." });
      return;
    }

    res.json(results);
  } catch (error) {
    console.error("Error fetching facings by batch ID:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
