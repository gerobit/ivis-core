const { SignalSetType } = require('../../../shared/signal-sets');

exports.up = (knex, Promise) => (async() =>  {
    await knex.schema.table('signal_sets', table => {
        table.string('type').notNullable().defaultTo(SignalSetType.NORMAL);
    });
})();

exports.down = (knex, Promise) => (async() =>  {
})();
