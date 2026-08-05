import db from "./db.js";

db.exec("DELETE FROM order_items; DELETE FROM orders; DELETE FROM menu_items;");
db.exec("DELETE FROM sqlite_sequence WHERE name IN ('menu_items', 'orders', 'order_items');");

const menuItems = [
  { name: "Veg Thali", description: "Rice, dal, sabzi, roti, pickle", price_rupees: 90, category: "Mains" },
  { name: "Paneer Butter Masala + Roti", description: "Paneer in creamy tomato gravy, 2 rotis", price_rupees: 110, category: "Mains" },
  { name: "Chole Bhature", description: "Spiced chickpeas with fried bhature", price_rupees: 70, category: "Mains" },
  { name: "Veg Fried Rice", description: "Wok-tossed rice with mixed vegetables", price_rupees: 80, category: "Rice & Bowls" },
  { name: "Veg Biryani", description: "Fragrant rice layered with spiced vegetables", price_rupees: 100, category: "Rice & Bowls" },
  { name: "Curd Rice", description: "Comfort rice tempered with curry leaves and curd", price_rupees: 60, category: "Rice & Bowls" },
  { name: "Grilled Sandwich", description: "Cheese and veggies, grilled", price_rupees: 60, category: "Snacks" },
  { name: "Samosa (2 pcs)", description: "Crisp pastry with spiced potato filling", price_rupees: 30, category: "Snacks" },
  { name: "Veg Puff", description: "Flaky pastry with a savoury veg filling", price_rupees: 25, category: "Snacks" },
  { name: "Cold Coffee", description: "Iced coffee blended with milk", price_rupees: 50, category: "Beverages" },
  { name: "Masala Chai", description: "Spiced milk tea", price_rupees: 20, category: "Beverages" },
  { name: "Fresh Lime Soda", description: "Sweet, salted, or mixed", price_rupees: 35, category: "Beverages" },
  { name: "Gulab Jamun (2 pcs)", description: "Warm syrup-soaked milk dumplings", price_rupees: 40, category: "Desserts" },
];

const insertMenu = db.prepare(
  "INSERT INTO menu_items (name, description, price_rupees, category) VALUES (@name, @description, @price_rupees, @category)"
);
for (const item of menuItems) insertMenu.run(item);

const menuByName = Object.fromEntries(
  db.prepare("SELECT * FROM menu_items").all().map((m) => [m.name, m])
);

function minutesAgoTimestamp(minutes) {
  return new Date(Date.now() - minutes * 60000).toISOString().slice(0, 19).replace("T", " ");
}

function seedOrder(studentName, status, itemQtyPairs, minutesAgo) {
  const items = itemQtyPairs.map(([name, quantity]) => ({ item: menuByName[name], quantity }));
  const total = items.reduce((sum, i) => sum + i.item.price_rupees * i.quantity, 0);
  const ts = minutesAgoTimestamp(minutesAgo);

  const { lastInsertRowid: orderId } = db
    .prepare(
      "INSERT INTO orders (student_name, status, total_rupees, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
    )
    .run(studentName, status, total, ts, ts);

  const insertItem = db.prepare(
    "INSERT INTO order_items (order_id, menu_item_id, name, price_rupees, quantity) VALUES (?, ?, ?, ?, ?)"
  );
  for (const { item, quantity } of items) {
    insertItem.run(orderId, item.id, item.name, item.price_rupees, quantity);
  }
}

seedOrder("Aisha", "New", [["Veg Thali", 1], ["Masala Chai", 1]], 1);
seedOrder("Rohan", "Accepted", [["Chole Bhature", 1]], 6);
seedOrder("Priya", "Preparing", [["Veg Biryani", 1], ["Cold Coffee", 1]], 9);
seedOrder("Karthik", "Ready for Pickup", [["Grilled Sandwich", 2], ["Fresh Lime Soda", 1]], 14);
seedOrder("Meera", "Completed", [["Samosa (2 pcs)", 1], ["Masala Chai", 1]], 25);

console.log(`Seeded ${menuItems.length} menu items and 5 sample orders.`);
