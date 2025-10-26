// Shared data между ботом и mini app (временное решение до БД)
const sessions = new Map();
const chatMembers = new Map();

module.exports = {
  sessions,
  chatMembers
};
