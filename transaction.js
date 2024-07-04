const mysql = require('mysql2/promise');
const nodemailer = require('nodemailer');
const config = require('./config');
require('dotenv').config();


async function sendOrderConfirmationEmail(orderDetails, customerEmail) {
    let transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_PASS
        }
    });

    let mailOptions = {
        from: process.env.GMAIL_USER,
        to: customerEmail,
        subject: 'Order Confirmation',
        text: `Your order with details ${orderDetails} has been confirmed.`
    };

    try {
        let info = await transporter.sendMail(mailOptions);
        console.log('Email sent: ' + info.response);
    } catch (error) {
        console.error('Error sending email: ', error);
        throw error;
    }
}

async function executePOS() {
    // 2. Collect shopping items, shipping and CX information:
    const items = ['BL0001', 'SP0004'];
    const customerAddress = "45 Princes St, Edinburgh EH10 7TG";
    const customerEmail = "@hw.ac.uk"; 
    const couponCode = "XYZ123";

    const connection = await mysql.createConnection(config.db);
    await connection.execute('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
    console.log('Isolation level has been set to READ COMMITTED');

    // Start the real SQL transaction:
    await connection.beginTransaction();
    try {
        await connection.execute('SELECT id, name FROM products WHERE code IN (?, ?) FOR UPDATE', items);
        console.log(`Locked rows for codes ${items.join()}`);
        const [itemsToOrder,] = await connection.execute('SELECT name, stock, price from products WHERE code IN (?, ?) ORDER BY id', items);
        console.log('Selected stock quantities for items');

    // 3. Calculate the order price:
    let orderTotal = 0; 
    let orderItems = [];
    for (let itemToOrder of itemsToOrder) {
         if (itemToOrder.stock < 1) {
            throw new Error(`One of the items is out of stock: ${itemToOrder.name}`);
    }

    console.log(`Stock for ${itemToOrder.name} is ${itemToOrder.stock}`);
    orderTotal += parseFloat(itemToOrder.price); 
    orderItems.push(itemToOrder.name);
    }

    orderTotal = orderTotal.toFixed(2);

    // Insert order into the orders table
    await connection.execute(
    'INSERT INTO orders (items, total, customer_email) VALUES (?, ?, ?)',
    [orderItems.join(), orderTotal, customerEmail]

    );

    console.log(`Order created`);

    // 4. Update the product inventory (stock update):
     await connection.execute(
        `UPDATE products SET stock = stock - 1 WHERE code IN (?, ?)`,
        items
     );
    console.log(`Deducted stock by 1 for ${items.join()}`);

    // 9. Commit the transaction:
     await connection.commit();
      const [rows,] = await connection.execute('SELECT LAST_INSERT_ID() as order_id');
      const orderId = rows[0].order_id;
      console.log(`Order created with ID: ${orderId}`);

      
      // 8. Send order & payment confirmation email:
       const orderDetails = `Order ID: ${orderId}, Items: ${orderItems.join()}, Total: ${orderTotal}`;
       await sendOrderConfirmationEmail(orderDetails, customerEmail);

        return `Order created with ID ${orderId}`;
    } catch (err) {
        // 10. Rollback the whole transaction
        console.error(`Error occurred while creating order: ${err.message}`, err);
        await connection.rollback();
        console.info('Rollback successful');
        return 'Error creating order';
    }
}

(async function testTransaction() {
    console.log(await executePOS());
    process.exit(0);
})();
