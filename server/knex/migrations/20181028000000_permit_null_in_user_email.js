exports.up = (knex, Promise) => (async() =>  {
    await knex.schema
        .raw('ALTER TABLE `users` DROP KEY `email`')
        .raw('ALTER TABLE `users` MODIFY `email` VARCHAR(255) CHARACTER SET utf8 DEFAULT NULL')
        .raw('ALTER TABLE `users` ADD KEY `email` (`email`)')
})();

exports.down = (knex, Promise) => (async() =>  {
})();
