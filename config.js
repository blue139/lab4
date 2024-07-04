const env = process.env;

const config = {
    db: {
        host: env.DB_HOST || 'localhost',
        user: env.DB_USER || 'root',
        password: env.DB_PASSWORD || '123',
        database: env.DB_NAME || 'lab',
    },
    email: {
        service: 'gmail',
        auth: {
            user: env.GMAIL_USER || '',
            pass: env.GMAIL_PASS || '',
        },
    },
};

module.exports = config;
