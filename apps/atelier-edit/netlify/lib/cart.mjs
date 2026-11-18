export function validateCart(input, catalog) {
  if (
    !input ||
    !Array.isArray(input.lines) ||
    input.lines.length > 15 ||
    !Array.isArray(input.savedIds) ||
    input.savedIds.length > 100
  )
    return null;
  const products = new Map(catalog.map((p) => [p.id, p]));
  const seen = new Set();
  for (const line of input.lines) {
    const key = line?.productId + ":" + line?.variant;
    if (
      !products.get(line?.productId)?.variants.includes(line.variant) ||
      !Number.isInteger(line.quantity) ||
      line.quantity < 1 ||
      line.quantity > 9 ||
      seen.has(key)
    )
      return null;
    seen.add(key);
  }
  if (input.savedIds.some((id) => !products.has(id))) return null;
  return {
    lines: input.lines.map(({ productId, variant, quantity }) => ({
      productId,
      variant,
      quantity,
    })),
    savedIds: [...new Set(input.savedIds)],
  };
}
export function mergeCarts(member, guest) {
  const lines = new Map(
    member.lines.map((line) => [
      line.productId + ":" + line.variant,
      { ...line },
    ]),
  );
  for (const line of guest.lines) {
    const key = line.productId + ":" + line.variant;
    const old = lines.get(key);
    lines.set(key, {
      ...line,
      quantity: Math.min(9, line.quantity + (old?.quantity ?? 0)),
    });
  }
  return {
    lines: [...lines.values()].slice(0, 15),
    savedIds: [...new Set([...member.savedIds, ...guest.savedIds])].slice(
      0,
      100,
    ),
  };
}
