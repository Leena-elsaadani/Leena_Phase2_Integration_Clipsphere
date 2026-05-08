import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

import mongoose from 'mongoose';
import env from '../src/config/env.js';
import User from '../src/models/user.model.js';
import Video from '../src/models/video.model.js';
import Like from '../src/models/like.model.js';
import Comment from '../src/models/comment.model.js';
import Follower from '../src/models/follower.model.js';

const connectDB = async () => {
  try {
    await mongoose.connect(env.MONGO_URI, { autoIndex: true });
    console.log('MongoDB connected for seeding');
  } catch (error) {
    console.error('MongoDB connection failed', error);
    process.exit(1);
  }
};

const seedData = async () => {
  const password = await bcrypt.hash('Password123!', 10);

  const alice = await User.findOne({ email: 'alice@example.com' });
  const bob = await User.findOne({ email: 'bob@example.com' });

  const user1 = alice || await User.create({
    username: 'alice',
    email: 'alice@example.com',
    password,
    bio: 'Seed user Alice',
    avatarUrl: 'https://i.pravatar.cc/150?img=1',
  });

  const user2 = bob || await User.create({
    username: 'bob',
    email: 'bob@example.com',
    password,
    bio: 'Seed user Bob',
    avatarUrl: 'https://i.pravatar.cc/150?img=2',
  });

  const sampleVideo = await Video.findOne({ title: 'Seed trending video' });
  const video = sampleVideo || await Video.create({
    owner: user2._id,
    title: 'Seed trending video',
    description: 'This is a seeded trending sample video.',
    videoKey: 'videos/seed-trending.mp4',
    thumbnailKey: 'thumbnails/seed-trending.jpg',
    duration: 60,
    viewsCount: 42,
    status: 'public',
    trendingScore: 25,
  });

  if (!sampleVideo) {
    console.log('Created sample video');
  }

  const follower = await Follower.findOne({ follower: user1._id, following: user2._id });
  if (!follower) {
    await Follower.create({ follower: user1._id, following: user2._id });
    console.log('Created follower: alice → bob');
  }

  const like = await Like.findOne({ user: user1._id, video: video._id });
  if (!like) {
    await Like.create({ user: user1._id, video: video._id });
    console.log('Created like from alice to sample video');
  }

  const comment = await Comment.findOne({ user: user1._id, video: video._id, text: 'Nice seed video!' });
  if (!comment) {
    await Comment.create({
      user: user1._id,
      video: video._id,
      text: 'Nice seed video!',
    });
    console.log('Created sample comment');
  }

  const videoCount = await Video.countDocuments();
  const userCount = await User.countDocuments();
  const likeCount = await Like.countDocuments();
  const commentCount = await Comment.countDocuments();
  const followCount = await Follower.countDocuments();

  console.log('Seed complete:');
  console.log(`  users: ${userCount}`);
  console.log(`  videos: ${videoCount}`);
  console.log(`  likes: ${likeCount}`);
  console.log(`  comments: ${commentCount}`);
  console.log(`  followers: ${followCount}`);
};

const run = async () => {
  await connectDB();
  try {
    await seedData();
  } catch (error) {
    console.error('Seeding failed:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

run();
