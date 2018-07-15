
exports.up = (knex, Promise) => (async() =>  {
    await knex.schema.table('templates', table => {
        table.boolean('elevated_access').defaultTo(false).notNullable();
    });
})();

exports.down = (knex, Promise) => (async() =>  {
})();
