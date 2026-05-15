export const WEAR_CATEGORIES = [
    // --- top_wear ---
    { name: 'long_sleeve_shirts', prompt: 'A photo of a long-sleeved button-up shirt with a structured collar and full-length buttons, whether plain or patterned' },
    { name: 'polo_shirts', prompt: 'A photo of a short-sleeved polo shirt with a ribbed collar, a short buttoned placket, and piqué fabric texture, distinct from a plain t-shirt' },
    { name: 't_shirts', prompt: 'A photo of a casual cotton t-shirt with a simple crew neck and no buttons' },
    { name: 'knitwear', prompt: 'A photo of a wool sweater, cardigan or knitted jumper' },
    { name: 'hoodies_sweatshirts', prompt: 'A photo of a hoodie with a hood or a casual cotton sweatshirt' },

    // --- bottom_wear ---
    { name: 'denim_jeans', prompt: 'A photo of classic black or denim blue jeans showing the denim fabric texture' },
    { name: 'dress_pants', prompt: 'A photo of tailored dress pants, chinos or trousers made of suit fabric or cotton twill' },
    { name: 'sport_pants', prompt: 'A photo of athletic leggings, nylon track pants or cotton joggers' },
    { name: 'shorts_bermudas', prompt: 'A photo of knee-length bermuda shorts or casual shorts' },
    { name: 'skirts', prompt: 'A photo of a skirt' },

    // --- outerwear ---
    { name: 'dresses', prompt: 'A photo of a dress or a gown' },
    { name: 'outerwear', prompt: 'A photo of a jacket, coat, bomber, overcoat or parka' },
    { name: 'swimwear', prompt: 'A photo of swimming trunks, board shorts or a swimsuit' },

    // --- footwear ---
    { name: 'sneakers', prompt: 'A photo of athletic sneakers, trainers or gym shoes' },
    { name: 'formal_shoes', prompt: 'A photo of leather dress shoes, loafers or oxfords' },
    { name: 'boots', prompt: 'A photo of leather boots, ankle boots or work boots' },
    { name: 'sandals_slippers', prompt: 'A photo of sandals, flip-flops or slides' },

    // --- accessories ---
    { name: 'bags_backpacks', prompt: 'A photo of a backpack or rucksack' },
    { name: 'bags_handbags', prompt: 'A photo of a handbag, tote bag or purse' },
    { name: 'eyewear', prompt: 'A photo of sunglasses or optical glasses' },
    { name: 'headwear', prompt: 'A photo of a hat, cap, beanie or beret' },
    { name: 'jewelry_watches', prompt: 'A photo of a wristwatch, bracelet or necklace' }
] as const;

export type ItemCategory = typeof WEAR_CATEGORIES[number]['name'];
export const ITEM_CATEGORIES = WEAR_CATEGORIES.map(c => c.name);