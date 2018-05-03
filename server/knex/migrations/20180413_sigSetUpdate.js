exports.up = (knex, Promise) => (async () => {
    await knex.raw('SET FOREIGN_KEY_CHECKS=0');

    await knex.raw('SET FOREIGN_KEY_CHECKS=1');
})();

exports.down = (knex, Promise) => (async () => {
    await knex.raw('SET FOREIGN_KEY_CHECKS=0');
    await knex.raw('SET FOREIGN_KEY_CHECKS=1');
})();