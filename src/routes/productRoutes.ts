import express from "express";
import {
  createProduct,
  getProducts,
  createCompetitorProduct,
  getCompetitorProducts,
  updateCompetitorProduct,
  deleteCompetitorProduct,
} from "../controllers/productController";
import middleware from "../utils/middleware";

const router = express.Router();

router.get("/", middleware.authorizeRole(["admin", "employee"]), getProducts);
router.get(
  "/competitor",
  middleware.authorizeRole(["admin", "employee"]),
  getCompetitorProducts
);
router.post(
  "/",
  middleware.authorizeRole(["admin", "employee"]),
  createProduct
);
router.post(
  "/competitor",
  middleware.authorizeRole(["admin"]),
  createCompetitorProduct
);
router.put(
  "/competitor/:product_id",
  middleware.authorizeRole(["admin"]),
  updateCompetitorProduct
);
router.delete(
  "/competitor/:product_id",
  middleware.authorizeRole(["admin"]),
  deleteCompetitorProduct
);

export default router;
