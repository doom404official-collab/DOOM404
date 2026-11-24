| Protocol | Instruction | Slot | Genuine transaction signature |
|---|---|---:|---|
| Jupiter V6 | route_with_token_ledger | 473279031 | `QLRecwEFMcGKmdAhWXCArBNsq6TDXPnmBhDcoWQf1jeXF1EJTVYe7f3XYG5MCPfXSofHh6R6jECPGdXkezRV6PY` |
| Jupiter V6 | route | 422601727 | `2ohtjAdt2w58FxBLCQJXx3CJ2Jy2s6zELMSBdFiVCX91XY6XGUa3LaBSzQCHvT7vE6jnpp2HEiG2mkBCUdEQtdTF` |
| Raydium AMM V4 | swap_base_in | 473279031 | `QLRecwEFMcGKmdAhWXCArBNsq6TDXPnmBhDcoWQf1jeXF1EJTVYe7f3XYG5MCPfXSofHh6R6jECPGdXkezRV6PY` |
| Raydium AMM V4 | swap_base_in_v2 | 422601727 | `2ohtjAdt2w58FxBLCQJXx3CJ2Jy2s6zELMSBdFiVCX91XY6XGUa3LaBSzQCHvT7vE6jnpp2HEiG2mkBCUdEQtdTF` |
| Raydium CPMM | swap_base_input | 346124444 | `3vPDgCSu8pozGa2q88VaEvRbYDH71LNkU7PGz51GmKAFzitPwakjJDhexLobDPy1p5J3LH1t2zcaiaDme8AXtddR` |
| Raydium CLMM | swap_v2 | 473279149 | `5jeNkpLy1wo6oeJEaX54G89XUwbSQw6iSysdZHjSjFErMMwBwsz4qexhG9BBiALzBGm1QMWNT57JcTWwYwHjjAj9` |
| PumpSwap AMM | sell | 378858612 | `2vDwiFJMwjTrxerx2SbTmNfnuGiktwWjz28nZqMD3nQsCSYNJT9Hk9c7FanEFGbDvKrEMyaEM8k7b2356uRD4hHF` |
| PumpSwap AMM | withdraw | 467214684 | `4wx15pybaxz64r7vz9es8N33LMYUUj5B8YuVNfHebX1xCn81TLsw7QyGVY6hEWePpAQfukpv3mdq2ufekzSM1V7U` |

AMM V4 validation uses the official opcode/account layout, successful execution and verified pool owner. Named instruction logs are unavailable for AMM V4. Other listed instructions have matching named execution logs. Swap instruction parameters are not asserted as actual fill amounts.

Exact withdrawal attribution is enabled only for PumpSwap withdraw. Raydium and Orca reductions are recognized-only; exact attribution is disabled pending genuine withdrawal validation. Jupiter RouteV2 and proVF4 routing are unsupported.
