import supabase from "../config/supabase.js";
import redis from "../config/redis.js";

export const placeOrder = async (req, res) => {
    const { user_id, medicine_list } = req.body;

    // 1. checking basic request input
    if (!user_id || !medicine_list || !Array.isArray(medicine_list) || medicine_list.length === 0) {
        return res.status(400).json({
            success: false,
            message: "user_id and a non-empty medicine_list are required"
        });
    }

    const acquiredLocks = [];

    try {
        // 2. Redis lock 
        for (const item of medicine_list) {
            const lockKey = `lock:medicine:${item.medicine_id}`;
            const acquired = await redis.set(lockKey, "locked", {
                NX: true,
                EX: 10
            });

            if (!acquired) {
                return res.status(409).json({
                    success: false,
                    message: `Medicine ID ${item.medicine_id} is currently locked by another transaction. Please try again.`
                });
            }
            acquiredLocks.push(lockKey);
        }

        // 3. checking stock space and calculate total price
        let totalPrice = 0;
        const validatedItems = [];

        for (const item of medicine_list) {
            const { data: medicine, error: fetchError } = await supabase
                .from("medicines")
                .select("*")
                .eq("id", item.medicine_id)
                .single();

            if (fetchError || !medicine) {
                return res.status(404).json({
                    success: false,
                    message: `Medicine ID ${item.medicine_id} not found`
                });
            }

            if (medicine.stock < item.quantity) {
                return res.status(400).json({
                    success: false,
                    message: `Insufficient stock for ${medicine.name}. Available: ${medicine.stock}, Requested: ${item.quantity}`
                });
            }

            totalPrice += medicine.price * item.quantity;
            validatedItems.push({
                medicine,
                quantity: item.quantity
            });
        }

        // 4. Deduct stock in Supabase PostgreSQL
        for (const item of validatedItems) {
            const newStock = item.medicine.stock - item.quantity;
            const { error: updateError } = await supabase
                .from("medicines")
                .update({ stock: newStock })
                .eq("id", item.medicine.id);

            if (updateError) {
                throw new Error(`Failed to update stock for medicine ID ${item.medicine.id}: ${updateError.message}`);
            }
        }

        // 5. Create order in Supabase PostgreSQL
        const { data: order, error: orderError } = await supabase
            .from("orders")
            .insert([
                {
                    user_id,
                    total_amount: totalPrice
                }
            ])
            .select()
            .single();

        if (orderError) {
            throw new Error(`Failed to create order: ${orderError.message}`);
        }

        // 6. Create order_items in Supabase PostgreSQL
        const orderItemsData = validatedItems.map((item) => ({
            order_id: order.id,
            medicine_id: item.medicine.id,
            quantity: item.quantity,
            price: item.medicine.price
        }));

        const { error: itemsError } = await supabase
            .from("order_items")
            .insert(orderItemsData);

        if (itemsError) {
            throw new Error(`Failed to create order items: ${itemsError.message}`);
        }

        // 7. Invalidate the medicines cache in Redis 
        await redis.del("medicines");

        // 8. Return success response
        res.status(200).json({
            success: true,
            message: "Order placed successfully",
            data: {
                order_id: order.id,
                total_amount: totalPrice,
                items: orderItemsData
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    } finally {
        // 9. ALWAYS release all acquired locks whether the order completed or failed
        for (const lockKey of acquiredLocks) {
            await redis.del(lockKey);
        }
    }
};

export const getOrderDetails = async (req, res) => {
    try {
        const { order_id } = req.params;

        // 1. Fetch order along with order_items and medicine names from Supabase using join
        const { data: order, error } = await supabase
            .from("orders")
            .select(`
                id,
                user_id,
                total_amount,
                created_at,
                order_items (
                    medicine_id,
                    quantity,
                    price,
                    medicines (
                        name
                    )
                )
            `)
            .eq("id", order_id)
            .single();

        // 2. Handle order not found or database error
        if (error || !order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        // 3. Format order_items to cleanly include medicine_name
        const formattedOrderItems = order.order_items.map((item) => {
            const medicineName = Array.isArray(item.medicines)
                ? (item.medicines[0]?.name || "Unknown")
                : (item.medicines?.name || "Unknown");

            return {
                medicine_id: item.medicine_id,
                medicine_name: medicineName,
                quantity: item.quantity,
                price: item.price
            };
        });

        // 4. Return order details
        res.status(200).json({
            success: true,
            data: {
                id: order.id,
                user_id: order.user_id,
                total_amount: order.total_amount,
                created_at: order.created_at,
                order_items: formattedOrderItems
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
