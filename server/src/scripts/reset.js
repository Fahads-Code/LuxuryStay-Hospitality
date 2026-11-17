import { connectDB, disconnectDB, dbInfo } from '../config/db.js';
import { User } from '../models/User.js';
import { Guest } from '../models/Guest.js';
import { RoomType } from '../models/RoomType.js';
import { Room } from '../models/Room.js';
import { Booking } from '../models/Booking.js';
import { Invoice } from '../models/Invoice.js';
import { ServiceRequest } from '../models/ServiceRequest.js';
import { HousekeepingTask } from '../models/HousekeepingTask.js';
import { MaintenanceRequest } from '../models/MaintenanceRequest.js';
import { Feedback } from '../models/Feedback.js';
import { Notification } from '../models/Notification.js';
import { Setting } from '../models/Setting.js';

const models = [
  User,
  Guest,
  RoomType,
  Room,
  Booking,
  Invoice,
  ServiceRequest,
  HousekeepingTask,
  MaintenanceRequest,
  Feedback,
  Notification,
  Setting,
];

/**
 * Deletes every record so the hotel can start with its own real data.
 * The app then shows the first-run setup screen, where the owner creates
 * the administrator account and enters the hotel name.
 *
 * Destructive: requires the --yes flag.
 */
const run = async () => {
  if (!process.argv.includes('--yes')) {
    console.error('This deletes ALL hotel data. Re-run with: npm run reset -- --yes');
    process.exitCode = 1;
    return;
  }

  try {
    await connectDB();

    for (const model of models) {
      const result = await model.deleteMany({});
      console.log(`[reset] ${model.modelName}: ${result.deletedCount} removed`);
    }

    if (dbInfo().memory) {
      console.log('[reset] NOTE: this ran against the temporary in-memory database.');
    }
    console.log('[reset] Done. Open the app to create the administrator account.');
  } catch (error) {
    console.error('[reset] Failed:', error);
    process.exitCode = 1;
  } finally {
    await disconnectDB();
  }
};

run();
