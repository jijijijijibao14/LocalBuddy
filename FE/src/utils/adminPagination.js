export { paginate } from "./pagination.js";

export function filterAccounts(users, role, query, status) {
  const needle = query.trim().toLocaleLowerCase();
  return users.filter((user) =>
    user.role === role &&
    (!status || user.status === status) &&
    (!needle || [user.fullName, user.email].some((value) =>
      (value || "").toLocaleLowerCase().includes(needle),
    )),
  );
}
