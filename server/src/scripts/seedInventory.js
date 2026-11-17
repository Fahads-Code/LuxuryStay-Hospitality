import { connectDB, disconnectDB, dbInfo } from '../config/db.js';
import { RoomType } from '../models/RoomType.js';
import { Room } from '../models/Room.js';
import { roomPlan, roomTypeSeed } from '../data/roomInventory.js';

/**
 * Creates the starting room inventory: five room types and 100 rooms
 * numbered 001–100 (ten per floor), with each floor dedicated to a single
 * room type. Safe to run more than once — existing room types and rooms are
 * left untouched, so owner edits are never overwritten.
 *
 * Run from the repository root:
 *   npm run seed:inventory
 */
const run = async () => {
  try {
    await connectDB();

    let typesAdded = 0;
    const typeIds = new Map();

    for (const type of roomTypeSeed) {
      const result = await RoomType.updateOne(
        { name: type.name },
        { $setOnInsert: type },
        { upsert: true }
      );
      if (result.upsertedCount) typesAdded += 1;

      const doc = await RoomType.findOne({ name: type.name });
      typeIds.set(type.name, doc);
    }

    let roomsAdded = 0;
    for (const plan of roomPlan) {
      const type = typeIds.get(plan.type);
      if (!type) {
        throw new Error(`Missing room type "${plan.type}" for room ${plan.number}`);
      }

      const result = await Room.updateOne(
        { number: plan.number },
        {
          $setOnInsert: {
            number: plan.number,
            floor: plan.floor,
            type: type._id,
            rate: type.baseRate,
            view: plan.view,
            status: 'available',
            isActive: true,
          },
        },
        { upsert: true }
      );
      if (result.upsertedCount) roomsAdded += 1;
    }

    const [typeCount, roomCount] = await Promise.all([
      RoomType.countDocuments(),
      Room.countDocuments(),
    ]);

    console.log('');
    console.log('  Starting inventory ready');
    console.log(`  ${typeCount} room types (${typesAdded} added)`);
    console.log(`  ${roomCount} rooms (${roomsAdded} added, numbered 001–100)`);
    console.log('');
    if (dbInfo().memory) {
      console.log('  NOTE: this ran against the temporary in-memory database.');
      console.log('  Set MONGODB_URI and USE_MEMORY_DB=false to save real data.');
      console.log('');
    }
  } catch (error) {
    console.error('[seed:inventory] Failed:', error);
    process.exitCode = 1;
  } finally {
    await disconnectDB();
  }
};

run();
