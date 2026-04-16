-- EMS Database Schema for Supabase
-- Energy Management System

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Energy Systems Configuration
CREATE TABLE energy_systems (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    system_type VARCHAR(20) NOT NULL CHECK (system_type IN ('pv', 'battery', 'pcs', 'grid', 'load')),
    name VARCHAR(100) NOT NULL,
    capacity_kw DECIMAL(10,3) NOT NULL,
    capacity_kwh DECIMAL(10,3),
    rated_voltage_dc DECIMAL(10,2),
    rated_voltage_ac DECIMAL(10,2),
    efficiency DECIMAL(5,4) DEFAULT 0.95,
    min_soc DECIMAL(5,2),
    max_soc DECIMAL(5,2),
    operational_status VARCHAR(20) DEFAULT 'standby' CHECK (operational_status IN ('standby', 'running', 'fault', 'offline')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rooms
CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    area_m2 DECIMAL(10,2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Circuit Breakers
CREATE TABLE circuit_breakers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    rated_current_amp DECIMAL(10,2),
    status VARCHAR(20) DEFAULT 'online' CHECK (status IN ('online', 'offline')),
    breaker_status VARCHAR(20) DEFAULT 'closed' CHECK (breaker_status IN ('closed', 'open')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Telemetry Data (Time-series)
CREATE TABLE telemetry_data (
    id BIGSERIAL PRIMARY KEY,
    system_id UUID REFERENCES energy_systems(id) ON DELETE CASCADE,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    power_kw DECIMAL(10,3) NOT NULL,
    voltage_dc DECIMAL(10,2),
    voltage_ac DECIMAL(10,2),
    current_amp DECIMAL(10,3),
    soc_percent DECIMAL(5,2),
    temperature_c DECIMAL(7,3),
    irradiance_wm2 DECIMAL(10,3),
    cumulative_energy_kwh DECIMAL(12,3) DEFAULT 0,
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_telemetry_system_time ON telemetry_data(system_id, recorded_at DESC);
CREATE INDEX idx_telemetry_time_range ON telemetry_data(recorded_at DESC) WHERE recorded_at > NOW() - INTERVAL '30 days';

-- Room Telemetry
CREATE TABLE room_telemetry (
    id BIGSERIAL PRIMARY KEY,
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    circuit_breaker_id UUID REFERENCES circuit_breakers(id) ON DELETE CASCADE,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    power_kw DECIMAL(10,3) NOT NULL,
    voltage_v DECIMAL(10,2),
    current_amp DECIMAL(10,3),
    energy_kwh DECIMAL(12,3) DEFAULT 0
);

CREATE INDEX idx_room_telemetry_room_time ON room_telemetry(room_id, recorded_at DESC);

-- Control Commands
CREATE TABLE control_commands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    system_id UUID REFERENCES energy_systems(id) ON DELETE SET NULL,
    breaker_id UUID REFERENCES circuit_breakers(id) ON DELETE SET NULL,
    command_type VARCHAR(50) NOT NULL,
    command_payload JSONB NOT NULL DEFAULT '{}',
    issued_by VARCHAR(100) NOT NULL,
    issued_at TIMESTAMPTZ DEFAULT NOW(),
    executed_at TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'executing', 'completed', 'failed')),
    result_message TEXT
);

CREATE INDEX idx_control_commands_status ON control_commands(status, issued_at DESC);

-- Alarm Events
CREATE TABLE alarm_events (
    id BIGSERIAL PRIMARY KEY,
    system_id UUID REFERENCES energy_systems(id) ON DELETE SET NULL,
    room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
    alarm_type VARCHAR(50) NOT NULL,
    severity VARCHAR(10) NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    message TEXT NOT NULL,
    trigger_value DECIMAL(15,3) NOT NULL,
    threshold_value DECIMAL(15,3) NOT NULL,
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by VARCHAR(100),
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alarms_active ON alarm_events(acknowledged, created_at DESC) WHERE acknowledged = FALSE;
CREATE INDEX idx_alarms_system ON alarm_events(system_id, created_at DESC);

-- Alarm Thresholds
CREATE TABLE alarm_thresholds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    system_id UUID REFERENCES energy_systems(id) ON DELETE CASCADE,
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    alarm_type VARCHAR(50) NOT NULL,
    threshold_min DECIMAL(15,3),
    threshold_max DECIMAL(15,3),
    severity VARCHAR(10) NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scheduled Operations
CREATE TABLE scheduled_operations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    system_id UUID REFERENCES energy_systems(id) ON DELETE CASCADE,
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    operation_type VARCHAR(50) NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    repeat_pattern VARCHAR(20) DEFAULT 'none' CHECK (repeat_pattern IN ('none', 'daily', 'weekly', 'monthly')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    created_by VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scheduled_active ON scheduled_operations(status, scheduled_at DESC) WHERE status = 'active';

-- Energy Balance (for visualization)
CREATE TABLE energy_balance (
    id BIGSERIAL PRIMARY KEY,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    pv_power_kw DECIMAL(10,3) NOT NULL,
    battery_power_kw DECIMAL(10,3) NOT NULL,
    battery_soc DECIMAL(5,2) NOT NULL,
    grid_power_kw DECIMAL(10,3) NOT NULL,
    load_power_kw DECIMAL(10,3) NOT NULL,
    system_efficiency DECIMAL(5,4) NOT NULL
);

CREATE INDEX idx_energy_balance_time ON energy_balance(recorded_at DESC);

-- Enable Realtime for telemetry tables
ALTER PUBLICATION supabase_realtime ADD TABLE telemetry_data;
ALTER PUBLICATION supabase_realtime ADD TABLE room_telemetry;
ALTER PUBLICATION supabase_realtime ADD TABLE alarm_events;
ALTER PUBLICATION supabase_realtime ADD TABLE control_commands;
ALTER PUBLICATION supabase_realtime ADD TABLE energy_balance;

-- Row Level Security Policies
ALTER TABLE energy_systems ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE circuit_breakers ENABLE ROW LEVEL SECURITY;
ALTER TABLE telemetry_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE control_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE alarm_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE alarm_thresholds ENABLE ROW LEVEL SECURITY;
ALTER TABLE energy_balance ENABLE ROW LEVEL SECURITY;

-- Public read policies (for demo purposes - authenticated users can read)
CREATE POLICY "Public read energy_systems" ON energy_systems FOR SELECT USING (true);
CREATE POLICY "Public read rooms" ON rooms FOR SELECT USING (true);
CREATE POLICY "Public read circuit_breakers" ON circuit_breakers FOR SELECT USING (true);
CREATE POLICY "Public read telemetry" ON telemetry_data FOR SELECT USING (true);
CREATE POLICY "Public read room_telemetry" ON room_telemetry FOR SELECT USING (true);
CREATE POLICY "Public read control_commands" ON control_commands FOR SELECT USING (true);
CREATE POLICY "Public read alarm_events" ON alarm_events FOR SELECT USING (true);
CREATE POLICY "Public read alarm_thresholds" ON alarm_thresholds FOR SELECT USING (true);
CREATE POLICY "Public read energy_balance" ON energy_balance FOR SELECT USING (true);

-- Service role can insert/update (for simulation engine)
CREATE POLICY "Service role insert telemetry" ON telemetry_data FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role insert room_telemetry" ON room_telemetry FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role insert alarm_events" ON alarm_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role insert control_commands" ON control_commands FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role update control_commands" ON control_commands FOR UPDATE USING (true);
CREATE POLICY "Service role insert energy_balance" ON energy_balance FOR INSERT WITH CHECK (true);

-- Insert default energy systems
INSERT INTO energy_systems (id, system_type, name, capacity_kw, capacity_kwh, rated_voltage_dc, rated_voltage_ac, efficiency, min_soc, max_soc)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'pv', '光伏系统', 10, NULL, 800, NULL, 0.18, NULL, NULL),
    ('00000000-0000-0000-0000-000000000002', 'battery', '储能电池', 10, 50, 800, NULL, 0.95, 10, 90),
    ('00000000-0000-0000-0000-000000000003', 'pcs', 'PCS转换', 10, NULL, 800, 380, 0.95, NULL, NULL),
    ('00000000-0000-0000-0000-000000000004', 'grid', '电网', 100, NULL, NULL, 380, 1, NULL, NULL),
    ('00000000-0000-0000-0000-000000000005', 'load', '负载', 20, NULL, NULL, 380, 1, NULL, NULL);

-- Insert default rooms
INSERT INTO rooms (id, name, area_m2)
VALUES
    ('10000000-0000-0000-0000-000000000001', 'Room 1', 50),
    ('10000000-0000-0000-0000-000000000002', 'Room 2', 45),
    ('10000000-0000-0000-0000-000000000003', 'Room 3', 60),
    ('10000000-0000-0000-0000-000000000004', 'Room 4', 40),
    ('10000000-0000-0000-0000-000000000005', 'Room 5', 55),
    ('10000000-0000-0000-0000-000000000006', 'Room 6', 48);

-- Insert circuit breakers for each room
INSERT INTO circuit_breakers (room_id, name, rated_current_amp)
SELECT id, name || ' 断路器', 32 FROM rooms;

-- Insert default alarm thresholds
INSERT INTO alarm_thresholds (system_id, alarm_type, threshold_min, threshold_max, severity)
VALUES
    ('00000000-0000-0000-0000-000000000002', 'soc_low', 10, NULL, 'critical'),
    ('00000000-0000-0000-0000-000000000002', 'soc_low', 20, NULL, 'warning'),
    ('00000000-0000-0000-0000-000000000003', 'power_over', NULL, 10, 'warning'),
    ('00000000-0000-0000-0000-000000000003', 'power_over', NULL, 12, 'critical'),
    ('00000000-0000-0000-0000-000000000002', 'temperature_high', NULL, 45, 'warning'),
    ('00000000-0000-0000-0000-000000000002', 'temperature_high', NULL, 55, 'critical');
