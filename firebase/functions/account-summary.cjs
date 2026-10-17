// Read-time counts use Firestore indexes, never download account documents.
async function calculateAccountSummary(db, type, now = new Date()) {
  const count = async (query) => (await query.count().get()).data().count;
  if (type === "users") {
    const users = db.collection("Users");
    // Business dates use Africa/Lagos (UTC+1, no daylight saving time).
    const day = 86400000;
    const today = new Date(
      Math.floor((now.getTime() + 3600000) / day) * day - 3600000,
    );
    const weekAgo = new Date(today.getTime() - 7 * day);
    const twoWeeksAgo = new Date(today.getTime() - 14 * day);
    const [total, newToday, newThisWeek, newLastWeek] = await Promise.all([
      count(users),
      count(users.where("createdAt", ">=", today)),
      count(users.where("createdAt", ">=", weekAgo)),
      count(
        users
          .where("createdAt", ">=", twoWeeksAgo)
          .where("createdAt", "<", weekAgo),
      ),
    ]);
    return {
      type,
      total,
      newToday,
      newThisWeek,
      newLastWeek,
      growthRate: newLastWeek
        ? Number((((newThisWeek - newLastWeek) / newLastWeek) * 100).toFixed(1))
        : null,
      calculatedAt: now.toISOString(),
    };
  }
  if (type !== "riders") throw new Error("Invalid account type");
  const riders = db.collection("Riders");
  const vehicles = async (base) =>
    Object.fromEntries(
      await Promise.all(
        [0, 1, 2].map(async (vehicle) => [
          vehicle,
          await count(base.where("vehicleType", "==", vehicle)),
        ]),
      ),
    );
  const statusSummary = async (status) => {
    const base = riders.where("verificationStatus", "==", status);
    const [total, byVehicle] = await Promise.all([count(base), vehicles(base)]);
    return { total, byVehicle };
  };
  const [total, byVehicle, verified, pending, blocked] = await Promise.all([
    count(riders),
    vehicles(riders),
    statusSummary(1),
    statusSummary(0),
    statusSummary(2),
  ]);
  return {
    type,
    total,
    byVehicle,
    verified,
    pending,
    blocked,
    calculatedAt: now.toISOString(),
  };
}
module.exports = { calculateAccountSummary };
