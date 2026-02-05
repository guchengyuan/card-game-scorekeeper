import { io } from 'socket.io-client';

const URL = 'http://localhost:3000';
const USER_ID = 'test_user_concurrent';
const ROOM_ID = 'test_room_concurrent';

async function runTest() {
    console.log('Starting Concurrent Login Pressure Test...');
    
    const clients: any[] = [];
    const TOTAL_CLIENTS = 10; // Start with 10 for quick verification, 100 might overwhelm without proper setup
    
    // Create clients
    for (let i = 0; i < TOTAL_CLIENTS; i++) {
        const socket = io(URL, {
            transports: ['websocket'],
            autoConnect: false,
            forceNew: true
        });
        clients.push({ socket, id: i });
    }

    let kickedCount = 0;
    let connectedCount = 0;

    // Connect them sequentially to see the "kick" effect
    for (let i = 0; i < TOTAL_CLIENTS; i++) {
        const { socket, id } = clients[i];
        
        socket.on('connect', () => {
            console.log(`[Client ${id}] Connected ${socket.id}`);
            connectedCount++;
            
            // Join room
            socket.emit('join-room', { 
                roomId: ROOM_ID, 
                userId: USER_ID, 
                token: `mock_token_${USER_ID}` 
            });
        });
        
        socket.on('KICK_DUPLICATE_LOGIN', () => {
            console.log(`[Client ${id}] KICKED (Duplicate Login)`);
            kickedCount++;
            socket.disconnect();
        });

        socket.on('disconnect', (reason: string) => {
             console.log(`[Client ${id}] Disconnected: ${reason}`);
        });

        console.log(`Connecting Client ${id}...`);
        socket.connect();
        
        // Wait a bit to ensure server processes the join
        await new Promise(r => setTimeout(r, 500));
    }

    console.log('All clients connected attempt finished.');
    
    // Allow some time for final events
    await new Promise(r => setTimeout(r, 2000));
    
    console.log('-----------------------------------');
    console.log(`Total Attempts: ${TOTAL_CLIENTS}`);
    console.log(`Total Kicked: ${kickedCount}`);
    console.log(`Expected Kicked: ${TOTAL_CLIENTS - 1}`); // The last one should survive
    
    if (kickedCount === TOTAL_CLIENTS - 1) {
        console.log('TEST PASSED: Only one active session remained.');
    } else {
        console.log('TEST FAILED: Kick count mismatch.');
    }
    
    process.exit(0);
}

runTest();
