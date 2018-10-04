exports.up = (knex, Promise) => (async () => {
    await knex('users').whereNull('phone_cell').update('phone_cell', '');
    await knex('users').whereNull('address').update('address', '');
})();

exports.down = (knex, Promise) => (async () => {
})();