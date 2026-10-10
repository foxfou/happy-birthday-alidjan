// @ts-check
// Хранилище в памяти с теми же правилами, что и YDB: для тестов и локального сервера.
const { planRsvp, takenSeats } = require("./rsvp");

/** @returns {import("./handler").Store} */
function createMemoryStore() {
  /** @type {import("./rsvp").Guest[]} */
  let guests = [];
  return {
    takenSeats: async () => takenSeats(guests),
    listGuests: async () => guests,
    removeGuest: async (id) => {
      guests = guests.filter((guest) => guest.id !== id);
    },
    saveGuest: async (input) => {
      const plan = planRsvp(guests, input, new Date());
      if (plan.status === "ok") {
        guests = [...guests.filter((guest) => guest.id !== input.id), plan.guest];
      }
      return plan;
    },
  };
}

module.exports = { createMemoryStore };
