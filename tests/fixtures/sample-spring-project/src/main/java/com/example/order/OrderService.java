package com.example.order;

import org.springframework.stereotype.Service;
import java.util.List;

@Service
public class OrderService {

    private final OrderRepository orderRepository;

    public OrderService(OrderRepository orderRepository) {
        this.orderRepository = orderRepository;
    }

    public List<OrderResponse> findAll() {
        return orderRepository.findAll().stream()
                .map(this::toResponse)
                .toList();
    }

    public OrderResponse findById(Long id) {
        Order order = orderRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Order not found"));
        return toResponse(order);
    }

    public OrderResponse create(OrderRequest request) {
        Order order = new Order();
        order.setProductName(request.getProductName());
        order.setQuantity(request.getQuantity());
        order.setPrice(request.getPrice());
        return toResponse(orderRepository.save(order));
    }

    public OrderResponse update(Long id, OrderRequest request) {
        Order order = orderRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Order not found"));
        order.setProductName(request.getProductName());
        order.setQuantity(request.getQuantity());
        order.setPrice(request.getPrice());
        return toResponse(orderRepository.save(order));
    }

    public void delete(Long id) {
        orderRepository.deleteById(id);
    }

    private OrderResponse toResponse(Order order) {
        return new OrderResponse(order.getId(), order.getProductName(), order.getQuantity(), order.getPrice());
    }
}
