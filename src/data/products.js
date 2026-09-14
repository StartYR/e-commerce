export const categoryPresentation = Object.freeze({
  all: { name: '全部好物', icon: 'grid', order: 0 },
  paper: { icon: 'book', order: 1 },
  writing: { icon: 'pen', order: 2 },
  desk: { icon: 'desk', order: 3 },
  carry: { icon: 'bag', order: 4 },
})

export const productPresentation = Object.freeze({
  notebook: { art: 'notebook', color: '#6e826d', background: '#eef0e9', badge: '小店精选', order: 1 },
  'gel-pens': { art: 'pens', color: '#7d907c', background: '#f0eee8', order: 2 },
  spiral: { art: 'spiral', color: '#bba17c', background: '#f4ede3', badge: '人气好物', order: 3 },
  pouch: { art: 'pouch', color: '#c6b995', background: '#efede6', order: 4 },
  highlighters: { art: 'highlighters', color: '#c7a17d', background: '#f3eae5', order: 5 },
  tape: { art: 'tape', color: '#7f977e', background: '#ebefe8', order: 6 },
  planner: { art: 'planner', color: '#d0b594', background: '#f3efe6', order: 7 },
  pencils: { art: 'pencils', color: '#cda76e', background: '#eeeae2', order: 8 },
  clips: { art: 'clips', color: '#b9a987', background: '#eeeae3', order: 9 },
  tray: { art: 'tray', color: '#c6b8a1', background: '#edece5', order: 10 },
  notes: { art: 'notes', color: '#c0ba91', background: '#f1ede4', order: 11 },
  tote: { art: 'tote', color: '#c9bea3', background: '#eceee8', order: 12 },
})

export function presentCategory(category) {
  const presentation = categoryPresentation[category.id] || {}
  return { ...category, icon: presentation.icon || 'grid', order: presentation.order ?? 999 }
}

export function presentProduct(product) {
  const presentation = productPresentation[product.id] || {
    art: 'notebook',
    color: '#81907b',
    background: '#eef0e9',
    order: 999,
  }
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    price: Number(product.priceCents),
    stock: Number(product.stock),
    isActive: Boolean(product.isActive),
    category: product.categoryId,
    categoryName: product.categoryName,
    ...presentation,
  }
}

export function formatMoney(cents) {
  return (cents / 100).toFixed(2)
}
