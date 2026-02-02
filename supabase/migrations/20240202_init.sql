-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  openid VARCHAR(100) UNIQUE NOT NULL,
  nickname VARCHAR(100) NOT NULL,
  avatar VARCHAR(500),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Rooms Table
CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  code VARCHAR(8) UNIQUE NOT NULL,
  owner_id UUID REFERENCES users(id),
  max_players INTEGER DEFAULT 4 CHECK (max_players >= 2 AND max_players <= 8),
  status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'finished')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Players Table
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  room_id UUID REFERENCES rooms(id),
  nickname VARCHAR(100) NOT NULL,
  avatar VARCHAR(500),
  balance INTEGER DEFAULT 0,
  is_online BOOLEAN DEFAULT true,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, room_id)
);

-- 4. Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id),
  from_player_id UUID REFERENCES players(id),
  to_player_id UUID REFERENCES players(id),
  amount INTEGER NOT NULL CHECK (amount > 0),
  description VARCHAR(200),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
