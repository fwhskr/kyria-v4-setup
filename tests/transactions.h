#pragma once
#include "quantum.h"
void transaction_register_rpc(int id, void (*handler)(uint8_t, const void *, uint8_t, void *));
bool transaction_rpc_send(int id, uint8_t size, const void *data);
