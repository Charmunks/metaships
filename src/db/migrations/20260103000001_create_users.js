exports.up = function (knex) {
  return knex.schema.createTable("users", (table) => {
    table.uuid("id").primary().defaultTo(knex.fn.uuid());
    table.string("hackclub_id").unique().notNullable();
    table.string("email").unique();
    table.string("access_token");
    table.string("refresh_token");
    table.timestamp("token_expires_at");
    table.timestamps(true, true);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTable("users");
};
