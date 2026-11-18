import catalog from '../../public/catalog.json' with { type: 'json' };
import { deliveryOptions } from '../../src/atelier-delivery.js';

const products = new Map(catalog.map((product) => [product.id, product]));

export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function priceOrder(input) {
  if (!input || typeof input.requestId !== 'string' || !uuidPattern.test(input.requestId) ||
    typeof input.delivery !== 'string' || !Object.hasOwn(deliveryOptions, input.delivery) ||
    !Array.isArray(input.lines) || !input.lines.length || input.lines.length > 15) {
    return null;
  }
  const lines = [];
  const usedVariants = new Set();
  for (const line of input.lines) {
    const product = products.get(line?.productId);
    const variant = line?.variant;
    const quantity = line?.quantity;
    const key = line?.productId + ':' + variant;
    if (!product?.variants.includes(variant) || !Number.isInteger(quantity) || quantity < 1 ||
      quantity > 9 || usedVariants.has(key)) return null;
    usedVariants.add(key);
    lines.push({ productId: product.id, name: product.name, variant, quantity, price: product.price });
  }
  lines.sort((a, b) => a.productId.localeCompare(b.productId) || a.variant.localeCompare(b.variant));
  const shipping = deliveryOptions[input.delivery].fee;
  const total = lines.reduce((sum, line) => sum + line.price * line.quantity, shipping);
  return { requestId: input.requestId, delivery: input.delivery, shipping, total, lines };
}

export function catalogueWithStock(inventory) {
  const stock = new Map(inventory.map(({ product_id, variant, stock: count }) => [product_id + ':' + variant, count]));
  return catalog.map((product) => ({
    ...product,
    inventory: Object.fromEntries(product.variants.map((variant) => [variant, stock.get(product.id + ':' + variant) ?? 0])),
  }));
}

export function matchesOrder(receipt, order) {
  return receipt.delivery === order.delivery && receipt.lines.length === order.lines.length
    && receipt.lines.every((line, index) => {
      const other = order.lines[index];
      return line.productId === other.productId && line.variant === other.variant && line.quantity === other.quantity;
    });
}
