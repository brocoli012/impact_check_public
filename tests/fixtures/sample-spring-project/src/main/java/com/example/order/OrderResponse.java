package com.example.order;

public record OrderResponse(Long id, String productName, int quantity, double price) {
}
