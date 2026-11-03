CREATE TABLE `store_order_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`productId` int,
	`productName` varchar(180) NOT NULL,
	`unitPrice` int NOT NULL,
	`quantity` int NOT NULL,
	CONSTRAINT `store_order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `store_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderNumber` varchar(40) NOT NULL,
	`customerName` varchar(160) NOT NULL,
	`phone` varchar(40) NOT NULL,
	`wilaya` varchar(120) NOT NULL,
	`commune` varchar(120) NOT NULL,
	`address` text NOT NULL,
	`note` text,
	`total` int NOT NULL,
	`status` enum('nouvelle','confirmee','annulee','reportee','ne_repond_pas','transferee') NOT NULL DEFAULT 'nouvelle',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `store_orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `store_orders_orderNumber_unique` UNIQUE(`orderNumber`)
);
--> statement-breakpoint
CREATE TABLE `store_products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(180) NOT NULL,
	`name` varchar(180) NOT NULL,
	`category` varchar(80) NOT NULL,
	`categoryLabel` varchar(120) NOT NULL,
	`description` text NOT NULL,
	`image` text NOT NULL,
	`price` int NOT NULL,
	`oldPrice` int,
	`stock` int NOT NULL DEFAULT 0,
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `store_products_id` PRIMARY KEY(`id`),
	CONSTRAINT `store_products_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
ALTER TABLE `store_order_items` ADD CONSTRAINT `store_order_items_orderId_store_orders_id_fk` FOREIGN KEY (`orderId`) REFERENCES `store_orders`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `store_order_items` ADD CONSTRAINT `store_order_items_productId_store_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `store_products`(`id`) ON DELETE no action ON UPDATE no action;