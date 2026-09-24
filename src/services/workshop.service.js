// Workshops: CRUD, status transitions (R2, R8, R14), capacity edits (R9), catalogue search/filter/sort/paginate
// Services own the business rules. They throw ApiError and emit events after commit.

async function listWorkshops() { throw new Error('listWorkshops not implemented'); }
async function getWorkshop() { throw new Error('getWorkshop not implemented'); }
async function createWorkshop() { throw new Error('createWorkshop not implemented'); }
async function updateWorkshop() { throw new Error('updateWorkshop not implemented'); }
async function changeWorkshopStatus() { throw new Error('changeWorkshopStatus not implemented'); }
async function assignSpotRegistrars() { throw new Error('assignSpotRegistrars not implemented'); }
async function listParticipants() { throw new Error('listParticipants not implemented'); }

module.exports = { listWorkshops, getWorkshop, createWorkshop, updateWorkshop, changeWorkshopStatus, assignSpotRegistrars, listParticipants };
