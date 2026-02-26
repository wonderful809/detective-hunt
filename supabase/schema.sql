-- Run this in Supabase SQL Editor

create extension if not exists pgcrypto;

create table if not exists public.clues (
  code text primary key,
  title text not null,
  clue_text text not null,
  points integer not null default 2,
  created_at timestamptz not null default now()
);

create table if not exists public.teams (
  id uuid primary key,
  team_name text not null unique,
  members integer not null check (members between 3 and 4),
  created_at timestamptz not null default now()
);

create table if not exists public.scan_logs (
  id bigint generated always as identity primary key,
  team_id uuid not null references public.teams(id) on delete cascade,
  clue_code text not null references public.clues(code) on delete cascade,
  game_time_seconds integer not null,
  points_awarded integer not null default 2,
  created_at timestamptz not null default now(),
  unique (team_id, clue_code)
);

alter table public.clues enable row level security;
alter table public.teams enable row level security;
alter table public.scan_logs enable row level security;

drop policy if exists clues_read_all on public.clues;
create policy clues_read_all on public.clues for select using (true);

drop policy if exists teams_insert_all on public.teams;
create policy teams_insert_all on public.teams for insert with check (true);

drop policy if exists scan_logs_insert_all on public.scan_logs;
create policy scan_logs_insert_all on public.scan_logs for insert with check (true);

insert into public.clues (code, title, clue_text, points) values
('CLUE-01', 'The Start', 'I have four legs but cannot walk. I stay outside while others talk. I’m the quietest seat in the greenest space—find the next clue at my resting place.', 2),
('CLUE-02', 'Faraday''s Block (Room 323)', 'Leave the grass and seek the spark, head to the block named after the man who tamed the dark. Ascend to the third level of this hive, and find the door where 300 meets 23.', 2),
('CLUE-03', 'Vishveswara Seminar Hall', 'From the classroom to the grand stage. Seek the hall named after the Father of Indian Engineering. Where the mics are live and the speeches are tall, find the entrance to this scholarly hall.', 2),
('CLUE-04', 'Canteen Water Filter', 'Brainpower requires hydration! Head to the hub of snacks and treats. Don''t look at the tables or the seats—instead, find the silver flow that quenches every thirst. Your next hint is taped where the water comes first.', 2),
('CLUE-05', 'The Coded Scooty (AP39FK7467)', 'To move forward, find the Master’s two-wheeled steed in the parking rows. Its identity is AP39FK7467. Find this metal horse to move forward.', 2),
('CLUE-06', 'College Bus', 'The scooty is fast, but I carry the crowd. I’m big, I’m yellow, and I’m loud. Find the giant that takes you home every day; the next step is hidden near the Emergency Exit sign.', 2),
('CLUE-07', 'Saraswati Stage (APJ Abdul Kalam Block)', 'Move from the wheels to the Wings of Fire. Seek the block named after the Missile Man. At the feet of the Goddess of Wisdom (Saraswati), on the platform where many have performed, your final trial begins.', 2),
('CLUE-08', 'The Finale: Central Library (Luggage Area)', 'The hunt ends where knowledge is stored. Before entering the library, look at the Luggage Area pigeonholes and search for the locker containing the VLSI manual.', 2)
on conflict (code) do update set title = excluded.title, clue_text = excluded.clue_text, points = excluded.points;
