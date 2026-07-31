import supabase from "../config/supabase.js";
//1.
export const addMedicine = async (req, res) => {
    try {
        const {
            name,
            category,
            stock,
            price
        } = req.body;

        if (!name || !category || stock === undefined || price === undefined) {
            return res.status(400).json({
                success: false,
                message: "name, category, stock and price are required"
            });
        }

        const { data, error } = await supabase
            .from("medicines")
            .insert([
                {
                    name,
                    category,
                    stock,
                    price
                }
            ])
            .select()
            .single();

        if (error) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }

        res.status(200).json({
            success: true,
            message: "Medicine added successfully",
            data
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
//2.
export const updateStock = async (req, res) => {
    try {
        const { id } = req.params;
        const { quantity } = req.body;

        const { data, error } = await supabase
            .from("medicines")
            .update({ stock: quantity })
            .eq("id", id)
            .select()
            .single();

        if (error) {
            return res.status(500).json({
                message: error.message
            });
        }

        if (data.stock < data.low_stock_threshold) {
            console.log(`LOW STOCK ALERT: ${data.name}`);
        }

        res.status(200).json({
            message: "Stock updated successfully",
            data
        });

    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
};

//3.

export const getMedicines = async (req, res) => {
    try {
        const { category } = req.query;

        let query = supabase
            .from("medicines")
            .select("*");

        if (category) {
            query = query.eq("category", category);
        }

        const { data, error } = await query;

        if (error) {
            return res.status(500).json({
                message: error.message
            });
        }

        res.status(200).json({
            data
        });

    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
};